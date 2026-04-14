import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationRepository } from '../ports/conversation.repository';
import { MessageReadReceiptRepository } from '../ports/message-read-receipt.repository';
import { OutboxRepository } from '../ports/outbox.repository';
import { TransactionManager } from '../ports/transaction-manager';
import {
  CONVERSATION_REPOSITORY,
  MESSAGE_READ_RECEIPT_REPOSITORY,
  OUTBOX_REPOSITORY,
  TRANSACTION_MANAGER,
} from '../ports/tokens';
import { randomUUID } from 'crypto';
import { MessageReadEventPayload } from '../../domain/models/new-message-event.model';

export interface MarkMessagesReadCommand {
  currentUserId: string;
  conversationId: string;
  messageIds: string[];
}

@Injectable()
export class MarkMessagesReadUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversationRepository: ConversationRepository,
    @Inject(MESSAGE_READ_RECEIPT_REPOSITORY)
    private readonly readReceiptRepository: MessageReadReceiptRepository,
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(command: MarkMessagesReadCommand): Promise<void> {
    await this.transactionManager.runInTransaction(async (context) => {
      // Kiểm tra conversation tồn tại và user là member
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

      const now = new Date();

      // Tạo read receipts cho tất cả messages
      await this.readReceiptRepository.markAsRead(
        command.messageIds,
        command.currentUserId,
        context,
      );

      // Phát event cho mỗi message được đọc
      for (const messageId of command.messageIds) {
        const eventPayload: MessageReadEventPayload = {
          eventId: randomUUID(),
          eventType: 'MESSAGE_READ',
          occurredAt: now.toISOString(),
          conversationId: command.conversationId,
          messageId: messageId,
          userId: command.currentUserId,
          readAt: now.toISOString(),
        };

        await this.outboxRepository.create(
          {
            eventType: eventPayload.eventType,
            aggregateId: messageId,
            payload: eventPayload as unknown as Record<string, unknown>,
            occurredAt: now,
          },
          context,
        );
      }
    });
  }
}
