import 'reflect-metadata';
import { DataSource, Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { config } from './config';

@Entity('conversations')
@Index(['type', 'directKey'], { unique: true, where: 'direct_key IS NOT NULL' })
export class Conversation {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column('varchar', { length: 16 }) type!: 'DIRECT' | 'GROUP';
  @Column('varchar', { length: 255, nullable: true }) title?: string;
  @Column('varchar', { length: 36, name: 'created_by' }) createdBy!: string;
  @Column('varchar', { length: 255, nullable: true, name: 'direct_key' }) directKey?: string;
  @Column('varchar', { length: 36, nullable: true, name: 'last_message_id' }) lastMessageId?: string;
  @Column('text', { nullable: true, name: 'last_message_preview' }) lastMessagePreview?: string;
  @Column('datetime', { nullable: true, name: 'last_message_at' }) lastMessageAt?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @CreateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('conversation_members')
@Index(['userId', 'conversationId'])
export class ConversationMember {
  @PrimaryColumn('varchar', { length: 36, name: 'conversation_id' }) conversationId!: string;
  @PrimaryColumn('varchar', { length: 36, name: 'user_id' }) userId!: string;
  @CreateDateColumn({ name: 'joined_at' }) joinedAt!: Date;
}

@Entity('messages')
@Index(['conversationId', 'createdAt', 'id'])
export class Message {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column('varchar', { length: 36, name: 'conversation_id' }) conversationId!: string;
  @Column('varchar', { length: 36, name: 'sender_id' }) senderId!: string;
  @Column('varchar', { length: 32, name: 'content_type' }) contentType!: string;
  @Column('text') content!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}

@Entity('message_attachments')
export class MessageAttachment {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column('varchar', { length: 36, name: 'message_id' }) messageId!: string;
  @Column('varchar', { length: 255 }) key!: string;
  @Column('varchar', { length: 255 }) url!: string;
  @Column('varchar', { length: 255, name: 'original_name' }) originalName!: string;
  @Column('varchar', { length: 100, name: 'mime_type' }) mimeType!: string;
  @Column('bigint') size!: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}

// User entity for joining - read-only view from auth_service database
@Entity('users')
export class User {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column({ length: 255 }) username!: string;
  @Column({ length: 255 }) email!: string;
  @Column({ length: 255, name: 'display_name' }) displayName!: string;
  @Column({ length: 500, name: 'avatar_url', nullable: true }) avatarUrl?: string;
  @Column({ length: 1000, nullable: true }) bio?: string;
  @Column({ length: 50, nullable: true }) gender?: string;
  @Column({ type: 'date', nullable: true }) dateOfBirth?: Date;
  @Column({ length: 20, nullable: true }) phone?: string;
  @Column({ name: 'is_active', default: true }) isActive!: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @CreateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

export const AppDataSource = new DataSource({
  type: 'mariadb',
  ...config.db,
  synchronize: process.env.NODE_ENV !== 'production',
  logging: false,
  entities: [Conversation, ConversationMember, Message, MessageAttachment, User],
  connectorPackage: 'mysql2',
});

export async function ensureDatabase() {
  const { createConnection } = await import('mysql2/promise');
  const conn = await createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.username,
    password: config.db.password,
  });
  await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.end();
}
