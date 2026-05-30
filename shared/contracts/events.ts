export const RABBITMQ = {
  EXCHANGE: 'chat.events',
  ROUTING_KEYS: {
    MESSAGE_SENT: 'chat.message.sent',
    CONVERSATION_CREATED: 'chat.conversation.created',
    MESSAGE_READ: 'chat.message.read',
    TYPING_START: 'chat.typing.start',
    TYPING_STOP: 'chat.typing.stop',
    MESSAGE_DELETED: 'chat.message.deleted',
    REACTION_ADDED: 'chat.message.reaction.added',
    REACTION_REMOVED: 'chat.message.reaction.removed',
    USER_ONLINE: 'chat.user.online',
    USER_OFFLINE: 'chat.user.offline',
    USER_CREATED: 'user.created',
    USER_UPDATED: 'user.updated',
  } as const,
} as const;

export type RoutingKey = typeof RABBITMQ.ROUTING_KEYS[keyof typeof RABBITMQ.ROUTING_KEYS];

export interface ChatEvent {
  event: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface MessageSentPayload {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  contentType: string;
  createdAt: string;
  attachments?: any[];
  receiverIds: string[];
  allMemberIds: string[];
}

export interface ConversationCreatedPayload {
  conversationId: string;
  type: 'DIRECT' | 'GROUP';
  createdBy: string;
  memberIds: string[];
  title?: string;
}

export interface MessageReadPayload {
  conversationId: string;
  userId: string;
  messageId: string;
}
