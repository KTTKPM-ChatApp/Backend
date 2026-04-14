import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ConversationOrmEntity } from './conversation.orm-entity';
import { MessageOrmEntity } from './message.orm-entity';

@Entity({ name: 'conversation_members' })
export class ConversationMemberOrmEntity {
  @PrimaryColumn({
    name: 'conversation_id',
    type: 'uuid',
  })
  conversationId!: string;

  @PrimaryColumn({
    name: 'user_id',
    type: 'varchar',
    length: 128,
  })
  userId!: string;

  @CreateDateColumn({
    name: 'joined_at',
    type: 'timestamptz',
  })
  joinedAt!: Date;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'member',
  })
  role!: 'admin' | 'member';

  @DeleteDateColumn({
    name: 'left_at',
    type: 'timestamptz',
    nullable: true,
  })
  leftAt!: Date | null;

  @Column({
    name: 'last_read_message_id',
    type: 'uuid',
    nullable: true,
  })
  lastReadMessageId!: string | null;

  @Column({
    name: 'is_muted',
    type: 'boolean',
    default: false,
  })
  isMuted!: boolean;

  @Column({
    name: 'muted_until',
    type: 'timestamptz',
    nullable: true,
  })
  mutedUntil!: Date | null;

  @ManyToOne(() => ConversationOrmEntity, (conversation) => conversation.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: ConversationOrmEntity;

  @ManyToOne(() => MessageOrmEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'last_read_message_id' })
  lastReadMessage!: MessageOrmEntity | null;
}

