import axios from 'axios';
import { config } from './config';

export interface NewMessagePayload {
  messageId: string;
  senderId: string;
  senderName: string;
  receiverIds: string[];   // Tất cả participants (trừ sender) - hỗ trợ cả group
  conversationId: string;
  content: string;
  contentType: string;
  createdAt: string;
}

/**
 * Gửi HTTP notification tới realtime-service cho mỗi receiver.
 * Nếu REALTIME_SERVICE_URL không được cấu hình thì bỏ qua (graceful degradation).
 * Lỗi khi gọi realtime-service không làm fail request gốc.
 */
export async function notifyNewMessage(payload: NewMessagePayload): Promise<void> {
  const realtimeUrl = config.realtimeService.url;
  if (!realtimeUrl) {
    console.log('[notifier] REALTIME_SERVICE_URL not configured, skipping notification');
    return;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.realtimeService.internalApiKey) {
    headers['x-internal-api-key'] = config.realtimeService.internalApiKey;
  }

  const notifyEndpoint = `${realtimeUrl}/api/v1/internal/messages/notify`;

  try {
    await axios.post(
      notifyEndpoint,
      {
        message_id:      payload.messageId,
        conversation_id: payload.conversationId,
        sender_id:       payload.senderId,
        sender_name:     payload.senderName,
        receiver_ids:    payload.receiverIds,
        content:         payload.content,
        content_type:    payload.contentType,
        created_at:      payload.createdAt,
      },
      { headers, timeout: 3000 }
    );
  } catch (err: any) {
    console.warn(`[notifier] Failed to notify realtime-service:`, err.message);
  }
}

export interface SystemEventPayload {
  messageId: string;
  conversationId: string;
  senderId: string;
  systemEventType: string;
  metadata?: Record<string, any>;
}

export interface ConversationCreatedPayload {
  conversationId: string;
  type: string;
  memberIds: string[];
  title?: string;
  createdBy?: string;
}

export async function notifyConversationCreated(payload: ConversationCreatedPayload): Promise<void> {
  const realtimeUrl = config.realtimeService.url;
  if (!realtimeUrl) {
    console.log('[notifier] REALTIME_SERVICE_URL not configured, skipping conversation created');
    return;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.realtimeService.internalApiKey) {
    headers['x-internal-api-key'] = config.realtimeService.internalApiKey;
  }

  try {
    await axios.post(
      `${realtimeUrl}/api/v1/internal/conversations/created`,
      {
        conversation_id: payload.conversationId,
        type: payload.type,
        member_ids: payload.memberIds,
        title: payload.title,
        created_by: payload.createdBy,
      },
      { headers, timeout: 3000 }
    );
  } catch (err: any) {
    console.warn(`[notifier] Failed to notify conversation created:`, err.message);
  }
}

/**
 * Gửi system event tới realtime-service để broadcast STOMP cho tất cả member trong conversation.
 */
export async function notifySystemEvent(payload: SystemEventPayload, createdAt?: string): Promise<void> {
  const realtimeUrl = config.realtimeService.url;
  if (!realtimeUrl) {
    console.log('[notifier] REALTIME_SERVICE_URL not configured, skipping system event');
    return;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.realtimeService.internalApiKey) {
    headers['x-internal-api-key'] = config.realtimeService.internalApiKey;
  }

  const eventEndpoint = `${realtimeUrl}/api/v1/internal/events/system`;

  try {
    await axios.post(
      eventEndpoint,
      {
        message_id: payload.messageId,
        conversation_id: payload.conversationId,
        sender_id: payload.senderId,
        system_event_type: payload.systemEventType,
        metadata: payload.metadata ?? {},
        created_at: createdAt ?? new Date().toISOString(),
      },
      { headers, timeout: 3000 }
    );
  } catch (err: any) {
    console.warn(`[notifier] Failed to notify system event:`, err.message);
  }
}
