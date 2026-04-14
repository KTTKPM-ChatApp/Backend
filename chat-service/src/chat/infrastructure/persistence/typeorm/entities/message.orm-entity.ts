import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { MessageContentType } from '../../../../domain/enums/message-content-type.enum';
import { ConversationOrmEntity } from './conversation.orm-entity';
import { MessageReadReceiptOrmEntity } from './message-read-receipt.orm-entity';
import { MessageReactionOrmEntity } from './message-reaction.orm-entity';

@Entity({ name: 'messages' })
export class MessageOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({
    name: 'conversation_id',
    type: 'uuid',
  })
  conversationId!: string;

  @Column({
    name: 'sender_id',
    type: 'varchar',
    length: 128,
  })
  senderId!: string;

  @Column({
    name: 'content_type',
    type: 'varchar',
    length: 32,
  })
  contentType!: MessageContentType;

  @Column({
    type: 'text',
  })
  content!: string;

  @Column({
    name: 'reply_to_message_id',
    type: 'uuid',
    nullable: true,
  })
  replyToMessageId!: string | null;

  @Column({
    name: 'is_deleted',
    type: 'boolean',
    default: false,
  })
  isDeleted!: boolean;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamptz',
    nullable: true,
  })
  deletedAt!: Date | null;

  @Column({
    name: 'edited_at',
    type: 'timestamptz',
    nullable: true,
  })
  editedAt!: Date | null;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt!: Date;

  @ManyToOne(() => ConversationOrmEntity, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: ConversationOrmEntity;

  @ManyToOne(() => MessageOrmEntity, (message) => message.replies, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'reply_to_message_id' })
  replyTo!: MessageOrmEntity | null;

  @ManyToOne(() => MessageOrmEntity, (message) => message.replies)
  replies!: MessageOrmEntity[];

  @OneToMany(() => MessageReadReceiptOrmEntity, (receipt) => receipt.message)
  readReceipts!: MessageReadReceiptOrmEntity[];

  @OneToMany(() => MessageReactionOrmEntity, (reaction) => reaction.message)
  reactions!: MessageReactionOrmEntity[];
}

