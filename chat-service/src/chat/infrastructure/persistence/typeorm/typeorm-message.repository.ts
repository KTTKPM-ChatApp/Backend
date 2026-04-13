import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  CreateMessagePersistenceParams,
  ListMessagesPersistenceParams,
  MessageListResult,
  MessageRepository,
} from '../../../application/ports/message.repository';
import { TransactionContext } from '../../../application/ports/transaction-manager';
import { Message } from '../../../domain/models/message.model';
import { MessageOrmEntity } from './entities/message.orm-entity';
import { getEntityManager } from './typeorm-helpers';

@Injectable()
export class TypeOrmMessageRepository implements MessageRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(
    params: CreateMessagePersistenceParams,
    context?: TransactionContext,
  ): Promise<Message> {
    const manager = getEntityManager(this.dataSource.manager, context);
    const repository = manager.getRepository(MessageOrmEntity);
    const createdMessage = repository.create({
      id: randomUUID(),
      conversationId: params.conversationId,
      senderId: params.senderId,
      contentType: params.contentType,
      content: params.content,
    });

    await repository.save(createdMessage);
    return this.mapMessage(createdMessage);
  }

  async listByConversation(
    params: ListMessagesPersistenceParams,
  ): Promise<MessageListResult> {
    const queryBuilder = this.dataSource.manager
      .getRepository(MessageOrmEntity)
      .createQueryBuilder('message')
      .where('message.conversation_id = :conversationId', {
        conversationId: params.conversationId,
      })
      .orderBy('message.created_at', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(params.limit + 1);

    if (params.before) {
      queryBuilder.andWhere(
        '(message.created_at < :createdAt OR (message.created_at = :createdAt AND message.id < :messageId))',
        {
          createdAt: params.before.createdAt,
          messageId: params.before.messageId,
        },
      );
    }

    const rows = await queryBuilder.getMany();
    const hasMore = rows.length > params.limit;
    const page = rows.slice(0, params.limit).reverse();

    return {
      items: page.map((row) => this.mapMessage(row)),
      hasMore,
    };
  }

  private mapMessage(row: MessageOrmEntity): Message {
    return {
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      contentType: row.contentType,
      content: row.content,
      createdAt: row.createdAt,
    };
  }
}

