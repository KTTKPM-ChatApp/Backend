import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In, QueryFailedError } from 'typeorm';
import { DirectConversationConflictError } from '../../../application/errors/direct-conversation-conflict.error';
import {
  ConversationListResult,
  ConversationRepository,
  CreateConversationPersistenceParams,
  ListConversationsPersistenceParams,
} from '../../../application/ports/conversation.repository';
import { TransactionContext } from '../../../application/ports/transaction-manager';
import {
  ConversationListItem,
  ConversationWithMembers,
  LastMessageSnapshot,
} from '../../../domain/models/conversation.model';
import { ConversationMemberOrmEntity } from './entities/conversation-member.orm-entity';
import { ConversationOrmEntity } from './entities/conversation.orm-entity';
import { getEntityManager } from './typeorm-helpers';

@Injectable()
export class TypeOrmConversationRepository implements ConversationRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findById(
    conversationId: string,
    context?: TransactionContext,
  ): Promise<ConversationWithMembers | null> {
    const manager = getEntityManager(this.dataSource.manager, context);
    const conversation = await manager.getRepository(ConversationOrmEntity).findOne({
      where: {
        id: conversationId,
      },
      relations: {
        members: true,
      },
    });

    return conversation ? this.mapConversation(conversation) : null;
  }

  async findDirectByKey(
    directKey: string,
    context?: TransactionContext,
  ): Promise<ConversationWithMembers | null> {
    const manager = getEntityManager(this.dataSource.manager, context);
    const conversation = await manager.getRepository(ConversationOrmEntity).findOne({
      where: {
        directKey,
      },
      relations: {
        members: true,
      },
    });

    return conversation ? this.mapConversation(conversation) : null;
  }

  async create(
    params: CreateConversationPersistenceParams,
    context?: TransactionContext,
  ): Promise<ConversationWithMembers> {
    const manager = getEntityManager(this.dataSource.manager, context);
    const conversationRepository = manager.getRepository(ConversationOrmEntity);
    const memberRepository = manager.getRepository(ConversationMemberOrmEntity);
    const conversationId = randomUUID();

    try {
      const conversationEntity = conversationRepository.create({
        id: conversationId,
        type: params.type,
        title: params.title,
        createdBy: params.createdBy,
        directKey: params.directKey,
        lastMessageId: null,
        lastMessagePreview: null,
        lastMessageAt: null,
      });

      await conversationRepository.save(conversationEntity);
      await memberRepository.save(
        params.memberIds.map((memberId) =>
          memberRepository.create({
            conversationId,
            userId: memberId,
          }),
        ),
      );

      return this.mapConversation(conversationEntity, params.memberIds);
    } catch (error) {
      if (error instanceof QueryFailedError && this.isUniqueViolation(error)) {
        throw new DirectConversationConflictError();
      }

      throw error;
    }
  }

  async listForUser(
    params: ListConversationsPersistenceParams,
  ): Promise<ConversationListResult> {
    const conversationRepository =
      this.dataSource.manager.getRepository(ConversationOrmEntity);
    const queryBuilder = conversationRepository
      .createQueryBuilder('conversation')
      .innerJoin(
        ConversationMemberOrmEntity,
        'membership',
        'membership.conversation_id = conversation.id AND membership.user_id = :userId',
        {
          userId: params.userId,
        },
      )
      .addOrderBy('conversation.lastMessageAt', 'DESC')
      .addOrderBy('conversation.updatedAt', 'DESC')
      .addOrderBy('conversation.id', 'DESC')
      .take(params.limit + 1);

    if (params.cursor) {
      queryBuilder.andWhere(
        '(conversation.lastMessageAt < :activityAt OR (conversation.lastMessageAt IS NULL AND conversation.updatedAt < :activityAt) OR (conversation.lastMessageAt = :activityAt AND conversation.id < :conversationId))',
        {
          activityAt: params.cursor.activityAt,
          conversationId: params.cursor.conversationId,
        },
      );
    }

    const conversations = await queryBuilder.getMany();
    const hasMore = conversations.length > params.limit;
    const pageItems = conversations.slice(0, params.limit);
    const memberIdsByConversationId = await this.findMemberIdsByConversationIds(
      this.dataSource.manager,
      pageItems.map((conversation) => conversation.id),
    );

    return {
      items: pageItems.map((conversation) =>
        this.mapConversationListItem(
          conversation,
          memberIdsByConversationId.get(conversation.id) ?? [],
        ),
      ),
      hasMore,
    };
  }

  async updateLastMessage(
    conversationId: string,
    lastMessage: LastMessageSnapshot,
    context?: TransactionContext,
  ): Promise<void> {
    const manager = getEntityManager(this.dataSource.manager, context);

    await manager.getRepository(ConversationOrmEntity).update(
      {
        id: conversationId,
      },
      {
        lastMessageId: lastMessage.id,
        lastMessagePreview: lastMessage.preview,
        lastMessageAt: lastMessage.createdAt,
        updatedAt: lastMessage.createdAt,
      },
    );
  }

  private async findMemberIdsByConversationIds(
    manager: EntityManager,
    conversationIds: string[],
  ): Promise<Map<string, string[]>> {
    const groupedMembers = new Map<string, string[]>();

    if (conversationIds.length === 0) {
      return groupedMembers;
    }

    const members = await manager.getRepository(ConversationMemberOrmEntity).find({
      where: {
        conversationId: In(conversationIds),
      },
      order: {
        joinedAt: 'ASC',
      },
    });

    for (const member of members) {
      const memberIds = groupedMembers.get(member.conversationId) ?? [];
      memberIds.push(member.userId);
      groupedMembers.set(member.conversationId, memberIds);
    }

    return groupedMembers;
  }

  private mapConversation(
    conversation: ConversationOrmEntity,
    memberIds?: string[],
  ): ConversationWithMembers {
    const resolvedMemberIds =
      memberIds ?? conversation.members?.map((member) => member.userId) ?? [];

    return {
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      createdBy: conversation.createdBy,
      directKey: conversation.directKey,
      lastMessageId: conversation.lastMessageId,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      memberIds: resolvedMemberIds,
      memberCount: resolvedMemberIds.length,
    };
  }

  private mapConversationListItem(
    conversation: ConversationOrmEntity,
    memberIds: string[],
  ): ConversationListItem {
    return {
      ...this.mapConversation(conversation, memberIds),
      activityAt: conversation.lastMessageAt ?? conversation.updatedAt,
    };
  }

  private isUniqueViolation(error: QueryFailedError): boolean {
    const driverError = error.driverError as { code?: string } | undefined;
    return driverError?.code === '23505';
  }
}

