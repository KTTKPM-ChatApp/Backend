import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ChatbotConversation } from './chatbot-conversation.entity';

@Entity('chatbot_messages')
export class ChatbotMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  conversationId!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: string; // 'user' | 'assistant'

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'text', nullable: true })
  metadata?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => ChatbotConversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation!: ChatbotConversation;
}
