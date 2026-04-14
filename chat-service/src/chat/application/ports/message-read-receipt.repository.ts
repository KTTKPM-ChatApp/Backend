import { MessageReadReceipt, MessageReadStatus } from '../../domain/models/message-read-receipt.model';
import { TransactionContext } from './transaction-manager';

export interface CreateReadReceiptPersistenceParams {
  messageId: string;
  userId: string;
}

export interface MessageReadReceiptRepository {
  create(
    params: CreateReadReceiptPersistenceParams,
    context?: TransactionContext,
  ): Promise<MessageReadReceipt>;

  // Lấy danh sách user đã đọc một tin nhắn
  getReadStatus(
    messageId: string,
    context?: TransactionContext,
  ): Promise<MessageReadStatus>;

  // Đánh dấu đã đọc cho nhiều tin nhắn cùng lúc
  markAsRead(
    messageIds: string[],
    userId: string,
    context?: TransactionContext,
  ): Promise<void>;

  // Kiểm tra user đã đọc tin nhắn chưa
  hasRead(
    messageId: string,
    userId: string,
    context?: TransactionContext,
  ): Promise<boolean>;
}
