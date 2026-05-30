import 'reflect-metadata';
import { DataSource, DataSourceOptions, Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { config } from './config';

@Entity('conversations')
@Index(['type', 'directKey'], { unique: true, where: 'direct_key IS NOT NULL' })
export class Conversation {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column('varchar', { length: 16 }) type!: 'DIRECT' | 'GROUP';
  @Column('varchar', { length: 255, nullable: true }) title?: string;
  @Column('varchar', { length: 36, name: 'created_by' }) createdBy!: string;
  @Column('varchar', { length: 255, nullable: true, name: 'direct_key' }) directKey?: string;
  @Column('varchar', { length: 500, nullable: true, name: 'avatar_url' }) avatarUrl?: string;
  @Column('varchar', { length: 500, nullable: true }) description?: string;
  @Column('varchar', { length: 36, nullable: true, name: 'last_message_id' }) lastMessageId?: string;
  @Column('text', { nullable: true, name: 'last_message_preview' }) lastMessagePreview?: string;
  @Column('datetime', { nullable: true, name: 'last_message_at' }) lastMessageAt?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @CreateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('conversation_members')
@Index(['userId', 'conversationId'])
@Index(['conversationId', 'role'])
export class ConversationMember {
  @PrimaryColumn('varchar', { length: 36, name: 'conversation_id' }) conversationId!: string;
  @PrimaryColumn('varchar', { length: 36, name: 'user_id' }) userId!: string;
  @Column('varchar', { length: 20, name: 'role', default: 'MEMBER' }) role!: 'OWNER' | 'ADMIN' | 'MEMBER';
  @Column('varchar', { length: 100, name: 'nickname', nullable: true }) nickname?: string;
  @Column('boolean', { name: 'is_muted', default: false }) isMuted!: boolean;
  @Column('datetime', { name: 'last_read_at', nullable: true }) lastReadAt?: Date;
  @Column('datetime', { name: 'joined_at', default: () => 'CURRENT_TIMESTAMP' }) joinedAt!: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @CreateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('messages')
@Index(['conversationId', 'createdAt', 'id'])
@Index(['conversationId', 'senderId'])
@Index(['senderId', 'createdAt'])
@Index(['conversationId', 'createdAt', 'id', 'senderId'])
@Index(['replyToId'])
export class Message {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column('varchar', { length: 36, name: 'conversation_id' }) conversationId!: string;
  @Column('varchar', { length: 36, name: 'sender_id' }) senderId!: string;
  @Column('varchar', { length: 32, name: 'content_type' }) contentType!: string;
  @Column('text') content!: string;
  @Column('json', { name: 'attachments', nullable: true }) attachments?: any[];
  @Column('varchar', { length: 36, name: 'reply_to_id', nullable: true }) replyToId?: string;
  @Column('boolean', { name: 'is_edited', default: false }) isEdited!: boolean;
  @Column('datetime', { name: 'edited_at', nullable: true }) editedAt?: Date;
  @Column('boolean', { name: 'is_deleted', default: false }) isDeleted!: boolean;
  @Column('datetime', { name: 'deleted_at', nullable: true }) deletedAt?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @CreateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
  @Column('varchar', { length: 20, default: 'text', name: 'type' }) type!: string;
  @Column('varchar', { length: 20, nullable: true, name: 'message_type' }) messageType?: string;
  @Column('varchar', { length: 50, nullable: true, name: 'system_event_type' }) systemEventType?: string;
  @Column('json', { nullable: true, name: 'metadata' }) metadata?: Record<string, any> | null;
}

@Entity('message_pins')
@Index(['conversationId', 'messageId'], { unique: true })
export class MessagePin {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column('varchar', { length: 36, name: 'conversation_id' }) conversationId!: string;
  @Column('varchar', { length: 36, name: 'message_id' }) messageId!: string;
  @Column('varchar', { length: 36, name: 'pinned_by' }) pinnedBy!: string;
  @CreateDateColumn({ name: 'pinned_at' }) pinnedAt!: Date;
}

@Entity('message_reactions')
@Index(['messageId', 'userId', 'emoji'], { unique: true })
export class MessageReaction {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column('varchar', { length: 36, name: 'conversation_id' }) conversationId!: string;
  @Column('varchar', { length: 36, name: 'message_id' }) messageId!: string;
  @Column('varchar', { length: 36, name: 'user_id' }) userId!: string;
  @Column('varchar', { length: 32 }) emoji!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}

@Entity('message_forwards')
@Index(['forwardId', 'senderId'], { unique: true })
export class MessageForward {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column('varchar', { length: 36, name: 'forward_id' }) forwardId!: string;
  @Column('varchar', { length: 36, name: 'sender_id' }) senderId!: string;
  @Column('varchar', { length: 36, name: 'source_message_id' }) sourceMessageId!: string;
  @Column('json', { name: 'targets' }) targets!: Array<{ message_id: string; conversation_id: string }>;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}

@Entity('conversation_invites')
@Index(['conversationId', 'userId'])
@Index(['status', 'expiresAt'])
export class ConversationInvite {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column('varchar', { length: 36, name: 'conversation_id' }) conversationId!: string;
  @Column('varchar', { length: 36, name: 'invited_by' }) invitedBy!: string;
  @Column('varchar', { length: 36, name: 'user_id' }) userId!: string;
  @Column('varchar', { length: 20, name: 'status', default: 'PENDING' }) status!: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  @Column('text', { name: 'message', nullable: true }) message?: string;
  @Column('datetime', { name: 'expires_at' }) expiresAt!: Date;
  @Column('datetime', { name: 'responded_at', nullable: true }) respondedAt?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @CreateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('conversation_polls')
@Index(['conversationId', 'status'])
export class ConversationPoll {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column('varchar', { length: 36, name: 'conversation_id' }) conversationId!: string;
  @Column('varchar', { length: 36, name: 'created_by' }) createdBy!: string;
  @Column('text', { name: 'question' }) question!: string;
  @Column('json', { name: 'options' }) options!: PollOption[];
  @Column('boolean', { name: 'allow_multiple', default: false }) allowMultiple!: boolean;
  @Column('boolean', { name: 'allow_add_option', default: false }) allowAddOption!: boolean;
  @Column('boolean', { name: 'is_anonymous', default: false }) isAnonymous!: boolean;
  @Column('varchar', { length: 20, name: 'status', default: 'OPEN' }) status!: 'OPEN' | 'CLOSED';
  @Column('datetime', { name: 'expires_at', nullable: true }) expiresAt?: Date;
  @Column('datetime', { name: 'closed_at', nullable: true }) closedAt?: Date;
  @Column('datetime', { name: 'closed_by', nullable: true }) closedBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @CreateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('poll_votes')
@Index(['pollId', 'userId'])
export class PollVote {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column('varchar', { length: 36, name: 'poll_id' }) pollId!: string;
  @Column('varchar', { length: 36, name: 'user_id' }) userId!: string;
  @Column('json', { name: 'option_ids' }) optionIds!: string[];
  @CreateDateColumn({ name: 'voted_at' }) votedAt!: Date;
}

@Entity('conversation_calls')
@Index(['conversationId', 'status'])
export class ConversationCall {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column('varchar', { length: 36, name: 'conversation_id' }) conversationId!: string;
  @Column('varchar', { length: 36, name: 'started_by' }) startedBy!: string;
  @Column('varchar', { length: 20, name: 'type' }) type!: 'AUDIO' | 'VIDEO';
  @Column('varchar', { length: 20, name: 'status', default: 'ONGOING' }) status!: 'ONGOING' | 'ENDED';
  @Column('datetime', { name: 'started_at' }) startedAt!: Date;
  @Column('datetime', { name: 'ended_at', nullable: true }) endedAt?: Date;
  @Column('varchar', { length: 36, name: 'ended_by', nullable: true }) endedBy?: string;
  @Column('text', { name: 'end_reason', nullable: true }) endReason?: string;
  @Column('json', { name: 'participants' }) participants!: CallParticipant[];
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @CreateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('conversation_settings')
@Index(['conversationId'])
export class ConversationSettings {
  @PrimaryColumn('varchar', { length: 36, name: 'conversation_id' }) conversationId!: string;
  @Column('json', { name: 'permissions', nullable: true }) permissions?: ConversationPermissions;
  @Column('json', { name: 'policies', nullable: true }) policies?: ConversationPolicies;
  @Column('json', { name: 'features', nullable: true }) features?: ConversationFeatures;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @CreateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('user_pinned_conversations')
@Index(['userId'])
export class UserPinnedConversation {
  @PrimaryColumn('varchar', { length: 36, name: 'user_id' }) userId!: string;
  @PrimaryColumn('varchar', { length: 36, name: 'conversation_id' }) conversationId!: string;
  @CreateDateColumn({ name: 'pinned_at' }) pinnedAt!: Date;
}

@Entity('message_reads')
@Index(['messageId'])
@Index(['userId', 'conversationId'])
export class MessageRead {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column('varchar', { length: 36, name: 'message_id' }) messageId!: string;
  @Column('varchar', { length: 36, name: 'conversation_id' }) conversationId!: string;
  @Column('varchar', { length: 36, name: 'user_id' }) userId!: string;
  @CreateDateColumn({ name: 'read_at' }) readAt!: Date;
}

// Type definitions
export interface PollOption {
  id: string;
  label: string;
  votes: number;
  createdAt: Date;
}

export interface CallParticipant {
  userId: string;
  joinedAt: Date;
  leftAt?: Date;
}

export interface ConversationPermissions {
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  canCreatePolls: boolean;
  canStartCall: boolean;
  canSendMessage: boolean;
}

export interface ConversationPolicies {
  maxMembers: number;
  inviteApproval: boolean;
  messageRetention: number; // days
}

export interface ConversationFeatures {
  polls: boolean;
  calls: boolean;
  fileSharing: boolean;
  reactions: boolean;
}

@Entity('conversation_summaries')
@Index(['userId', 'lastMessageAt'])
@Index(['userId', 'unreadCount'])
@Index(['lastSenderId'])
@Index(['conversationId'])
export class ConversationSummary {
  @PrimaryColumn('varchar', { length: 36, name: 'user_id' }) userId!: string;
  @PrimaryColumn('varchar', { length: 36, name: 'conversation_id' }) conversationId!: string;
  @Column('varchar', { length: 36, nullable: true, name: 'last_message_id' }) lastMessageId?: string;
  @Column('text', { nullable: true, name: 'last_message_preview' }) lastMessagePreview?: string;
  @Column('datetime', { nullable: true, name: 'last_message_at' }) lastMessageAt?: Date;
  @Column('varchar', { length: 36, nullable: true, name: 'last_sender_id' }) lastSenderId?: string;
  @Column('varchar', { length: 255, nullable: true, name: 'last_sender_name' }) lastSenderName?: string;
  @Column('int', { default: 0, name: 'unread_count' }) unreadCount!: number;
  @Column('varchar', { length: 36, nullable: true, name: 'conversation_type' }) conversationType?: string;
  @Column('varchar', { length: 255, nullable: true }) conversationTitle?: string;
  @Column('varchar', { length: 500, nullable: true, name: 'conversation_avatar' }) conversationAvatar?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('message_attachments')
@Index(['messageId'])
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

@Entity('cloud_folders')
@Index(['userId'])
export class CloudFolder {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column('varchar', { length: 255 }) name!: string;
  @Column('varchar', { length: 36, name: 'user_id' }) userId!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('cloud_files')
@Index(['userId'])
@Index(['folderId'])
export class CloudFile {
  @PrimaryColumn('varchar', { length: 36 }) id!: string;
  @Column('varchar', { length: 255 }) name!: string;
  @Column('varchar', { length: 500 }) url!: string;
  @Column('varchar', { length: 100, name: 'mime_type' }) mimeType!: string;
  @Column('bigint') size!: number;
  @Column('varchar', { length: 36, name: 'folder_id', nullable: true }) folderId?: string | null;
  @Column('varchar', { length: 36, name: 'user_id' }) userId!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
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

function buildDataSource(): DataSourceOptions {
  const base = {
    type: 'mariadb' as const,
    database: config.db.database,
    synchronize: process.env.NODE_ENV !== 'production',
    logging: false,
    entities: [
      Conversation,
      ConversationMember,
      Message,
      MessagePin,
      MessageReaction,
      MessageForward,
      ConversationInvite,
      ConversationPoll,
      PollVote,
      ConversationCall,
      ConversationSettings,
      UserPinnedConversation,
      MessageRead,
      ConversationSummary,
      User,
      CloudFolder,
      CloudFile,
    ],
    connectorPackage: 'mysql2' as const,
    extra: {
      connectionLimit: config.db.poolSize,
      maxIdle: config.db.poolMaxIdle,
      idleTimeout: config.db.poolIdleTimeout,
      connectTimeout: 10000,
      waitForConnections: true,
      queueLimit: 100,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    },
  };

  if (config.db.replicaHost) {
    return {
      ...base,
      replication: {
        master: {
          host: config.db.host,
          port: config.db.port,
          username: config.db.username,
          password: config.db.password,
        },
        slaves: [{
          host: config.db.replicaHost,
          port: config.db.replicaPort,
          username: config.db.replicaUser || config.db.username,
          password: config.db.replicaPassword || config.db.password,
        }],
        selector: 'RR' as const,
        canRetry: true,
        removeNodeErrorCount: 5,
        restoreNodeTimeout: 5000,
      },
    };
  }

  return {
    ...base,
    host: config.db.host,
    port: config.db.port,
    username: config.db.username,
    password: config.db.password,
  };
}

export const AppDataSource = new DataSource(buildDataSource());

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
