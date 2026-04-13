import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ConversationOrmEntity } from './conversation.orm-entity';

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

  @ManyToOne(() => ConversationOrmEntity, (conversation) => conversation.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: ConversationOrmEntity;
}

