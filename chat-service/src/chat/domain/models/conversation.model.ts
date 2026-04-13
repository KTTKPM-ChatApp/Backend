import { ConversationType } from '../enums/conversation-type.enum';

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null;
  createdBy: string;
  directKey: string | null;
  lastMessageId: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationWithMembers extends Conversation {
  memberIds: string[];
  memberCount: number;
}

export interface ConversationListItem extends ConversationWithMembers {
  activityAt: Date;
}

export interface LastMessageSnapshot {
  id: string;
  preview: string;
  createdAt: Date;
}

