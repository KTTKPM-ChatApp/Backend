export interface ConversationCursorPayload {
  activityAt: string;
  conversationId: string;
}

export interface MessageCursorPayload {
  createdAt: string;
  messageId: string;
}

export function encodeCursor(payload: Record<string, string>): string {
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

export function decodeCursor<T>(cursor?: string): T | null {
  if (!cursor) {
    return null;
  }

  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8')) as T;
}
