import { BaseClient } from './base-client';

export interface MessageReadCallbackPayload {
  conversationId: string;
  userId: string;
  messageId: string;
}

export class GatewayClientService extends BaseClient {
  constructor(
    private readonly gatewayBaseUrl: string,
  ) {
    super();
  }

  protected get baseUrl(): string {
    return this.gatewayBaseUrl;
  }

  async messageCallback(conversationId: string, message: Record<string, any>): Promise<void> {
    try {
      await this.request({
        method: 'POST',
        path: '/api/internal/message-callback',
        data: { conversationId, message },
        timeout: 3000,
      });
    } catch (err: any) {
      console.warn(`[GatewayClient] Failed to call message callback:`, err.message);
    }
  }

  async conversationCallback(conversation: Record<string, any>): Promise<void> {
    try {
      await this.request({
        method: 'POST',
        path: '/api/internal/conversation-callback',
        data: { conversation },
        timeout: 3000,
      });
    } catch (err: any) {
      console.warn(`[GatewayClient] Failed to call conversation callback:`, err.message);
    }
  }

  async messageReadCallback(payload: MessageReadCallbackPayload): Promise<void> {
    try {
      await this.request({
        method: 'POST',
        path: '/api/internal/message-read-callback',
        data: payload,
        timeout: 3000,
      });
    } catch (err: any) {
      console.warn(`[GatewayClient] Failed to call message read callback:`, err.message);
    }
  }
}
