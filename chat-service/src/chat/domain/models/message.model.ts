import { MessageContentType } from '../enums/message-content-type.enum';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  contentType: MessageContentType;
  content: string;
  createdAt: Date;
}

