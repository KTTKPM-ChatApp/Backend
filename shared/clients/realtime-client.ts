import { BaseClient } from './base-client';

export interface NewMessagePayload {
  messageId: string;
  senderId: string;
  senderName: string;
  receiverIds: string[];
  conversationId: string;
  content: string;
  contentType: string;
  createdAt: string;
  attachments?: any[];
  replyToId?: string | null;
}

export interface SystemEventPayload {
  messageId: string;
  conversationId: string;
  senderId: string;
  systemEventType: string;
  metadata?: Record<string, any>;
}

export interface NewConversationPayload {
  conversationId: string;
  type: string;
  createdBy: string;
  memberIds: string[];
  title?: string;
}

export class RealtimeClientService extends BaseClient {
  constructor(
    private readonly realtimeBaseUrl: string,
    private readonly internalApiKey?: string,
  ) {
    super();
  }

  protected get baseUrl(): string {
    return this.realtimeBaseUrl;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.internalApiKey) {
      h['x-internal-api-key'] = this.internalApiKey;
    }
    return h;
  }

  async notifyNewMessage(payload: NewMessagePayload): Promise<void> {
    if (!this.realtimeBaseUrl) {
      console.log('[RealtimeClient] REALTIME_SERVICE_URL not configured, skipping');
      return;
    }
    try {
      await this.request({
        method: 'POST',
        path: '/api/v1/internal/messages/notify',
        headers: this.headers,
        data: {
          message_id: payload.messageId,
          conversation_id: payload.conversationId,
          sender_id: payload.senderId,
          sender_name: payload.senderName,
          receiver_ids: payload.receiverIds,
          content: payload.content,
          content_type: payload.contentType,
          created_at: payload.createdAt,
          attachments: payload.attachments ?? [],
          reply_to_id: payload.replyToId ?? null,
        },
        timeout: 3000,
      });
    } catch (err: any) {
      console.warn(`[RealtimeClient] Failed to notify message:`, err.message);
    }
  }

  async notifyMessageDeleted(payload: {
    messageId: string;
    conversationId: string;
    senderId: string;
    deletedAt: string;
  }): Promise<void> {
    if (!this.realtimeBaseUrl) {
      console.log('[RealtimeClient] REALTIME_SERVICE_URL not configured, skipping');
      return;
    }
    try {
      await this.request({
        method: 'POST',
        path: '/api/v1/internal/messages/delete',
        headers: this.headers,
        data: {
          message_id: payload.messageId,
          conversation_id: payload.conversationId,
          sender_id: payload.senderId,
          deleted_at: payload.deletedAt,
        },
        timeout: 3000,
      });
    } catch (err: any) {
      console.warn(`[RealtimeClient] Failed to notify message delete:`, err.message);
    }
  }

  async notifyNewConversation(payload: NewConversationPayload): Promise<void> {
    if (!this.realtimeBaseUrl) {
      console.log('[RealtimeClient] REALTIME_SERVICE_URL not configured, skipping');
      return;
    }
    try {
      await this.request({
        method: 'POST',
        path: '/api/v1/internal/conversations/notify',
        headers: this.headers,
        data: {
          conversation_id: payload.conversationId,
          type: payload.type,
          created_by: payload.createdBy,
          member_ids: payload.memberIds,
          title: payload.title ?? '',
        },
        timeout: 3000,
      });
    } catch (err: any) {
      console.warn(`[RealtimeClient] Failed to notify conversation:`, err.message);
    }
  }

  async notifyReactionAdded(payload: {
    messageId: string;
    conversationId: string;
    userId: string;
    emoji: string;
  }): Promise<void> {
    if (!this.realtimeBaseUrl) {
      console.log('[RealtimeClient] REALTIME_SERVICE_URL not configured, skipping');
      return;
    }
    try {
      await this.request({
        method: 'POST',
        path: '/api/v1/internal/messages/reactions/add',
        headers: this.headers,
        data: {
          message_id: payload.messageId,
          conversation_id: payload.conversationId,
          user_id: payload.userId,
          emoji: payload.emoji,
        },
        timeout: 3000,
      });
    } catch (err: any) {
      console.warn(`[RealtimeClient] Failed to notify reaction added:`, err.message);
    }
  }

  async notifyReactionRemoved(payload: {
    messageId: string;
    conversationId: string;
    userId: string;
    emoji: string;
  }): Promise<void> {
    if (!this.realtimeBaseUrl) {
      console.log('[RealtimeClient] REALTIME_SERVICE_URL not configured, skipping');
      return;
    }
    try {
      await this.request({
        method: 'POST',
        path: '/api/v1/internal/messages/reactions/remove',
        headers: this.headers,
        data: {
          message_id: payload.messageId,
          conversation_id: payload.conversationId,
          user_id: payload.userId,
          emoji: payload.emoji,
        },
        timeout: 3000,
      });
    } catch (err: any) {
      console.warn(`[RealtimeClient] Failed to notify reaction removed:`, err.message);
    }
  }

  async notifyGroupCallStarted(payload: {
    sessionId: string;
    conversationId: string;
    sfuRoomId: string;
    startedBy: string;
    hostId: string;
    memberIds: string[];
  }): Promise<void> {
    if (!this.realtimeBaseUrl) {
      console.log('[RealtimeClient] REALTIME_SERVICE_URL not configured, skipping');
      return;
    }
    try {
      await this.request({
        method: 'POST',
        path: '/api/v1/internal/calls/group/notify',
        headers: this.headers,
        data: {
          session_id: payload.sessionId,
          conversation_id: payload.conversationId,
          sfu_room_id: payload.sfuRoomId,
          started_by: payload.startedBy,
          host_id: payload.hostId,
          member_ids: payload.memberIds,
        },
        timeout: 3000,
      });
    } catch (err: any) {
      console.warn(`[RealtimeClient] Failed to notify group call:`, err.message);
    }
  }

  async notifySystemEvent(payload: SystemEventPayload, createdAt?: string): Promise<void> {
    if (!this.realtimeBaseUrl) {
      console.log('[RealtimeClient] REALTIME_SERVICE_URL not configured, skipping');
      return;
    }
    try {
      await this.request({
        method: 'POST',
        path: '/api/v1/internal/events/system',
        headers: this.headers,
        data: {
          message_id: payload.messageId,
          conversation_id: payload.conversationId,
          sender_id: payload.senderId,
          system_event_type: payload.systemEventType,
          metadata: payload.metadata ?? {},
          created_at: createdAt ?? new Date().toISOString(),
        },
        timeout: 3000,
      });
    } catch (err: any) {
      console.warn(`[RealtimeClient] Failed to notify system event:`, err.message);
    }
  }

  async notifyCallStarted(payload: {
    callId: string;
    conversationId: string;
    startedBy: string;
    type: string;
    memberIds: string[];
  }): Promise<void> {
    if (!this.realtimeBaseUrl) {
      console.log('[RealtimeClient] REALTIME_SERVICE_URL not configured, skipping');
      return;
    }
    try {
      await this.request({
        method: 'POST',
        path: '/api/v1/internal/calls/notify',
        headers: this.headers,
        data: {
          call_id: payload.callId,
          conversation_id: payload.conversationId,
          started_by: payload.startedBy,
          type: payload.type,
          member_ids: payload.memberIds,
        },
        timeout: 3000,
      });
    } catch (err: any) {
      console.warn(`[RealtimeClient] Failed to notify call started:`, err.message);
    }
  }
}
