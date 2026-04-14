import { MessageCursorPayload } from '../../../common/pagination/cursor';
import { MessageContentType } from '../../domain/enums/message-content-type.enum';
import { Message } from '../../domain/models/message.model';
import { TransactionContext } from './transaction-manager';

export interface CreateMessagePersistenceParams {
  conversationId: string;
  senderId: string;
  contentType: MessageContentType;
  content: string;
  replyToMessageId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface MessageListResult {
  items: Message[];
  hasMore: boolean;
}

export interface ListMessagesPersistenceParams {
  conversationId: string;
  limit: number;
  before: MessageCursorPayload | null;
}

export interface MessageRepository {
  create(
    params: CreateMessagePersistenceParams,
    context?: TransactionContext,
  ): Promise<Message>;
  listByConversation(
    params: ListMessagesPersistenceParams,
  ): Promise<MessageListResult>;
}

