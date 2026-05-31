import { config } from './config';
import { RealtimeClientService } from '../../shared/clients/realtime-client';
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

export async function notifyNewMessage(payload: NewMessagePayload): Promise<void> {
  await realtimeClient.notifyNewMessage(payload);
}

export async function notifyNewConversation(payload: NewConversationPayload): Promise<void> {
  await realtimeClient.notifyNewConversation(payload);
}

export async function notifyMessageDeleted(payload: {
  messageId: string;
  conversationId: string;
  senderId: string;
  deletedAt: string;
}): Promise<void> {
  await realtimeClient.notifyMessageDeleted(payload);
}

export async function notifyReactionAdded(payload: {
  messageId: string;
  conversationId: string;
  userId: string;
  emoji: string;
}): Promise<void> {
  await realtimeClient.notifyReactionAdded(payload);
}

export async function notifyReactionRemoved(payload: {
  messageId: string;
  conversationId: string;
  userId: string;
  emoji: string;
}): Promise<void> {
  await realtimeClient.notifyReactionRemoved(payload);
}

export async function notifySystemEvent(payload: SystemEventPayload, createdAt?: string): Promise<void> {
  await realtimeClient.notifySystemEvent(payload, createdAt);
}
