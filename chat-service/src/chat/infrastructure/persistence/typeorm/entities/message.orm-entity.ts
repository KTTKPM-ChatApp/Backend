import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { MessageContentType } from '../../../../domain/enums/message-content-type.enum';
import { ConversationOrmEntity } from './conversation.orm-entity';

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
}

