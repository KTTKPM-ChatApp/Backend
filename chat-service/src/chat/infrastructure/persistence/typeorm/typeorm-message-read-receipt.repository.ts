import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import {
  CreateReadReceiptPersistenceParams,
  MessageReadReceiptRepository,
} from '../../../application/ports/message-read-receipt.repository';
import { TransactionContext } from '../../../application/ports/transaction-manager';
import {
  MessageReadReceipt,
  MessageReadStatus,
} from '../../../domain/models/message-read-receipt.model';
import { MessageReadReceiptOrmEntity } from './entities/message-read-receipt.orm-entity';
import { getEntityManager } from './typeorm-helpers';

@Injectable()
export class TypeOrmMessageReadReceiptRepository
  implements MessageReadReceiptRepository
{
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(
    params: CreateReadReceiptPersistenceParams,
    context?: TransactionContext,
  ): Promise<MessageReadReceipt> {
    const manager = getEntityManager(this.dataSource.manager, context);
    const repository = manager.getRepository(MessageReadReceiptOrmEntity);

    const receipt = repository.create({
      messageId: params.messageId,
      userId: params.userId,
    });

    await repository.save(receipt);

    return {
      messageId: receipt.messageId,
      userId: receipt.userId,
      readAt: receipt.readAt,
    };
  }

  async getReadStatus(
    messageId: string,
    context?: TransactionContext,
  ): Promise<MessageReadStatus> {
    const manager = getEntityManager(this.dataSource.manager, context);
    const repository = manager.getRepository(MessageReadReceiptOrmEntity);

    const receipts = await repository.find({
      where: { messageId },
    });

    return {
      messageId,
      readBy: receipts.map((r) => r.userId),
      readCount: receipts.length,
    };
  }

  async markAsRead(
    messageIds: string[],
    userId: string,
    context?: TransactionContext,
  ): Promise<void> {
    const manager = getEntityManager(this.dataSource.manager, context);
    const repository = manager.getRepository(MessageReadReceiptOrmEntity);

    // Sử dụng INSERT ... ON CONFLICT DO NOTHING để tránh duplicate
    for (const messageId of messageIds) {
      const exists = await repository.findOne({
        where: { messageId, userId },
      });

      if (!exists) {
        const receipt = repository.create({
          messageId,
          userId,
        });
        await repository.save(receipt);
      }
    }
  }

  async hasRead(
    messageId: string,
    userId: string,
    context?: TransactionContext,
  ): Promise<boolean> {
    const manager = getEntityManager(this.dataSource.manager, context);
    const repository = manager.getRepository(MessageReadReceiptOrmEntity);

    const receipt = await repository.findOne({
      where: { messageId, userId },
    });

    return !!receipt;
  }
}
