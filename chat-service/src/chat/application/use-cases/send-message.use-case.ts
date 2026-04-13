import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MessageContentType } from '../../domain/enums/message-content-type.enum';
import { NewMessageEventPayload } from '../../domain/models/new-message-event.model';
import { ConversationRepository } from '../ports/conversation.repository';
import { MessageRepository } from '../ports/message.repository';
import { OutboxRepository } from '../ports/outbox.repository';
import { TransactionManager } from '../ports/transaction-manager';
import {
  CONVERSATION_REPOSITORY,
  MESSAGE_REPOSITORY,
  OUTBOX_REPOSITORY,
  TRANSACTION_MANAGER,
} from '../ports/tokens';
import { toMessageResponse } from './chat-presenter';

export interface SendMessageCommand {
  currentUserId: string;
  conversationId: string;
  contentType: MessageContentType;
  content: string;
}

@Injectable()
export class SendMessageUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepository: MessageRepository,
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(command: SendMessageCommand): Promise<ReturnType<typeof toMessageResponse>> {
    const normalizedContent = command.content.trim();

    if (command.contentType !== MessageContentType.TEXT) {
      throw new BadRequestException('Only TEXT messages are supported in v1.');
    }

    if (!normalizedContent) {
      throw new BadRequestException('Message content cannot be empty.');
    }

    const message = await this.transactionManager.runInTransaction(
      async (context) => {
        const conversation = await this.conversationRepository.findById(
          command.conversationId,
          context,
        );

        if (!conversation) {
          throw new NotFoundException('Conversation not found.');
        }

        if (!conversation.memberIds.includes(command.currentUserId)) {
          throw new ForbiddenException(
            'You are not a member of this conversation.',
          );
        }

        const createdMessage = await this.messageRepository.create(
          {
            conversationId: command.conversationId,
            senderId: command.currentUserId,
            contentType: command.contentType,
            content: normalizedContent,
          },
          context,
        );

        await this.conversationRepository.updateLastMessage(
          command.conversationId,
          {
            id: createdMessage.id,
            preview: normalizedContent.slice(0, 255),
            createdAt: createdMessage.createdAt,
          },
          context,
        );

        const eventPayload: NewMessageEventPayload = {
          eventId: randomUUID(),
          eventType: 'NEW_MESSAGE',
          occurredAt: createdMessage.createdAt.toISOString(),
          conversationId: conversation.id,
          conversationType: conversation.type,
          messageId: createdMessage.id,
          senderId: createdMessage.senderId,
          participantIds: conversation.memberIds,
          contentType: createdMessage.contentType,
          content: createdMessage.content,
          createdAt: createdMessage.createdAt.toISOString(),
        };

        await this.outboxRepository.create(
          {
            eventType: eventPayload.eventType,
            aggregateId: createdMessage.id,
            payload: eventPayload as unknown as Record<string, unknown>,
            occurredAt: createdMessage.createdAt,
          },
          context,
        );

        return createdMessage;
      },
    );

    return toMessageResponse(message);
  }
}

