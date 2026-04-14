export interface MessageReadReceipt {
  messageId: string;
  userId: string;
  readAt: Date;
}

export interface MessageReadStatus {
  messageId: string;
  readBy: string[]; // Danh sách user đã đọc
  readCount: number;
}
