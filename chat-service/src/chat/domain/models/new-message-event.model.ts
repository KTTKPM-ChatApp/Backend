import { ConversationType } from '../enums/conversation-type.enum';
import { MessageContentType } from '../enums/message-content-type.enum';

export interface NewMessageEventPayload {
  eventId: string;
  eventType: 'NEW_MESSAGE';
  occurredAt: string;
  conversationId: string;
  conversationType: ConversationType;
  messageId: string;
  senderId: string;
  participantIds: string[];
  contentType: MessageContentType;
  content: string;
  replyToMessageId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// Event khi tin nhắn được đọc
export interface MessageReadEventPayload {
  eventId: string;
  eventType: 'MESSAGE_READ';
  occurredAt: string;
  conversationId: string;
  messageId: string;
  userId: string; // Người đọc
  readAt: string;
}

// Event khi conversation được tạo
export interface ConversationCreatedEventPayload {
  eventId: string;
  eventType: 'CONVERSATION_CREATED';
  occurredAt: string;
  conversationId: string;
  conversationType: ConversationType;
  createdBy: string;
  participantIds: string[];
  title: string | null;
}

// Event khi user được thêm vào conversation
export interface UserAddedToConversationEventPayload {
  eventId: string;
  eventType: 'USER_ADDED_TO_CONVERSATION';
  occurredAt: string;
  conversationId: string;
  userId: string; // Người được thêm
  addedBy: string; // Người thêm
  role: 'admin' | 'member';
}

// Event khi tin nhắn bị xóa (soft delete)
export interface MessageDeletedEventPayload {
  eventId: string;
  eventType: 'MESSAGE_DELETED';
  occurredAt: string;
  conversationId: string;
  messageId: string;
  deletedBy: string;
  deletedAt: string;
}

// Union type cho tất cả events
export type ChatEventPayload =
  | NewMessageEventPayload
  | MessageReadEventPayload
  | ConversationCreatedEventPayload
  | UserAddedToConversationEventPayload
  | MessageDeletedEventPayload;

