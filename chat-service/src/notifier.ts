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

  const promises = payload.receiverIds.map(receiverId =>
    axios.post(
      notifyEndpoint,
      {
        message_id:      payload.messageId,
        sender_id:       payload.senderId,
        sender_name:     payload.senderName,
        receiver_id:     receiverId,
        conversation_id: payload.conversationId,
        content:         payload.content,
        content_type:    payload.contentType,
        created_at:      payload.createdAt,
      },
      { headers, timeout: 3000 }
    ).catch((err: Error) => {
      // Log nhưng không throw — không làm fail toàn bộ request
      console.warn(`[notifier] Failed to notify realtime-service for user ${receiverId}:`, err.message);
    })
  );

  await Promise.allSettled(promises);
}
