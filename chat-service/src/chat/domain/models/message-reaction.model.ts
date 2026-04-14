export interface MessageReaction {
  messageId: string;
  userId: string;
  reaction: string; // emoji hoặc reaction code
  createdAt: Date;
}

export interface MessageReactionSummary {
  reaction: string;
  count: number;
  users: string[]; // userIds
}
