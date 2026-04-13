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
  createdAt: string;
}

