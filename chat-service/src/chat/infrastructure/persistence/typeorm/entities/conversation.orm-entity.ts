import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ConversationType } from '../../../../domain/enums/conversation-type.enum';
import { ConversationMemberOrmEntity } from './conversation-member.orm-entity';
import { MessageOrmEntity } from './message.orm-entity';

@Entity({ name: 'conversations' })
export class ConversationOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({
    type: 'varchar',
    length: 16,
  })
  type!: ConversationType;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  title!: string | null;

  @Column({
    name: 'created_by',
    type: 'varchar',
    length: 128,
  })
  createdBy!: string;

  @Column({
    name: 'direct_key',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  directKey!: string | null;

  @Column({
    name: 'last_message_id',
    type: 'uuid',
    nullable: true,
  })
  lastMessageId!: string | null;

  @Column({
    name: 'last_message_preview',
    type: 'text',
    nullable: true,
  })
  lastMessagePreview!: string | null;

  @Column({
    name: 'last_message_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastMessageAt!: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt!: Date;

  @OneToMany(() => ConversationMemberOrmEntity, (member) => member.conversation)
  members!: ConversationMemberOrmEntity[];

  @OneToMany(() => MessageOrmEntity, (message) => message.conversation)
  messages!: MessageOrmEntity[];
}

