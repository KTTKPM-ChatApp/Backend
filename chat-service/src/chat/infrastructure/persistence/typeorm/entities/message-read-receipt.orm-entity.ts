import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { MessageOrmEntity } from './message.orm-entity';

@Entity({ name: 'message_read_receipts' })
export class MessageReadReceiptOrmEntity {
  @PrimaryColumn({
    name: 'message_id',
    type: 'uuid',
  })
  messageId!: string;

  @PrimaryColumn({
    name: 'user_id',
    type: 'varchar',
    length: 128,
  })
  userId!: string;

  @CreateDateColumn({
    name: 'read_at',
    type: 'timestamptz',
  })
  readAt!: Date;

  @ManyToOne(() => MessageOrmEntity, (message) => message.readReceipts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'message_id' })
  message!: MessageOrmEntity;
}
