import {
  ConversationListItem,
  ConversationWithMembers,
} from '../../domain/models/conversation.model';
import { Message } from '../../domain/models/message.model';

export interface ConversationResponse {
  id: string;
  type: string;
  title: string | null;
  createdBy: string;
  memberIds: string[];
  memberCount: number;
  lastMessage: {
    id: string;
    preview: string;
    createdAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  contentType: string;
  content: string;
  createdAt: Date;
}

export function toConversationResponse(
  conversation: ConversationWithMembers | ConversationListItem,
): ConversationResponse {
  return {
    id: conversation.id,
    type: conversation.type,
    title: conversation.title,
    createdBy: conversation.createdBy,
    memberIds: conversation.memberIds,
    memberCount: conversation.memberCount,
    lastMessage:
      conversation.lastMessageId && conversation.lastMessageAt
        ? {
            id: conversation.lastMessageId,
            preview: conversation.lastMessagePreview ?? '',
            createdAt: conversation.lastMessageAt,
          }
        : null,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

export function toMessageResponse(message: Message): MessageResponse {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    contentType: message.contentType,
    content: message.content,
    createdAt: message.createdAt,
  };
}

