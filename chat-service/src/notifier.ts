import { config } from './config';
import { RealtimeClientService } from '../../shared/clients/realtime-client';
import { GatewayClientService } from '../../shared/clients/gateway-client';
import type {
  NewMessagePayload,
  SystemEventPayload,
  NewConversationPayload,
} from '../../shared/clients/realtime-client';

export type { NewMessagePayload, SystemEventPayload, NewConversationPayload };

const realtimeClient = new RealtimeClientService(
  config.realtimeService.url,
  config.realtimeService.internalApiKey,
);

const gatewayClient = new GatewayClientService(config.gatewayService.url);

export async function notifyNewMessage(payload: NewMessagePayload): Promise<void> {
  await Promise.allSettled([
    realtimeClient.notifyNewMessage(payload),
    gatewayClient.messageCallback(payload.conversationId, {
      messageId: payload.messageId,
      senderId: payload.senderId,
      senderName: payload.senderName,
      body: payload.content,
      createdAt: payload.createdAt,
      attachments: payload.attachments ?? [],
    }),
  ]);
}

export async function notifyNewConversation(payload: NewConversationPayload): Promise<void> {
  await Promise.allSettled([
    realtimeClient.notifyNewConversation(payload),
    gatewayClient.conversationCallback({
      conversationId: payload.conversationId,
      type: payload.type,
      createdBy: payload.createdBy,
      memberIds: payload.memberIds,
      title: payload.title,
    }),
  ]);
}

<<<<<<< HEAD
=======
export async function notifyMessageDeleted(payload: {
  messageId: string;
  conversationId: string;
  senderId: string;
  deletedAt: string;
}): Promise<void> {
  await realtimeClient.notifyMessageDeleted(payload);
}

>>>>>>> origin/main
export async function notifySystemEvent(payload: SystemEventPayload, createdAt?: string): Promise<void> {
  await realtimeClient.notifySystemEvent(payload, createdAt);
}
