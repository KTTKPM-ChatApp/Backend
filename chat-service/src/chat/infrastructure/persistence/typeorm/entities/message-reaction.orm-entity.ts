import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { MessageOrmEntity } from './message.orm-entity';

@Entity({ name: 'message_reactions' })
export class MessageReactionOrmEntity {
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

  @Column({
    type: 'varchar',
    length: 32,
  })
  reaction!: string; // emoji hoặc reaction code

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt!: Date;

  @ManyToOne(() => MessageOrmEntity, (message) => message.reactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'message_id' })
  message!: MessageOrmEntity;
}
