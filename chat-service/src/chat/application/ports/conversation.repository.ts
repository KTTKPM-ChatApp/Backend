import { ConversationCursorPayload } from '../../../common/pagination/cursor';
import { ConversationType } from '../../domain/enums/conversation-type.enum';
import {
  ConversationListItem,
  ConversationWithMembers,
  LastMessageSnapshot,
} from '../../domain/models/conversation.model';
import { TransactionContext } from './transaction-manager';

export interface CreateConversationPersistenceParams {
  type: ConversationType;
  title: string | null;
  createdBy: string;
  directKey: string | null;
  memberIds: string[];
  adminIds?: string[]; // Người tạo và các admin khác (cho group chat)
}

export interface ConversationListResult {
  items: ConversationListItem[];
  hasMore: boolean;
}

export interface ListConversationsPersistenceParams {
  userId: string;
  limit: number;
  cursor: ConversationCursorPayload | null;
}

export interface ConversationRepository {
  findById(
    conversationId: string,
    context?: TransactionContext,
  ): Promise<ConversationWithMembers | null>;
  findDirectByKey(
    directKey: string,
    context?: TransactionContext,
  ): Promise<ConversationWithMembers | null>;
  create(
    params: CreateConversationPersistenceParams,
    context?: TransactionContext,
  ): Promise<ConversationWithMembers>;
  listForUser(
    params: ListConversationsPersistenceParams,
  ): Promise<ConversationListResult>;
  updateLastMessage(
    conversationId: string,
    lastMessage: LastMessageSnapshot,
    context?: TransactionContext,
  ): Promise<void>;
}

