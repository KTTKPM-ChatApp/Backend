import { MessageContentType } from '../enums/message-content-type.enum';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  contentType: MessageContentType;
  content: string;
  replyToMessageId: string | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  editedAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface MessageWithReply extends Message {
  replyTo: Message | null;
}

