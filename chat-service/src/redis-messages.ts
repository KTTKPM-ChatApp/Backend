import { getRedisClient } from './redis';

const MSG_CACHE_TTL = 3600; // 1 hour
const MAX_MSGS_PER_CONV = 200; // keep last 200 messages per conversation

export function msgSortedSetKey(conversationId: string): string {
  return `msgs:${conversationId}`;
}

export function msgHashKey(messageId: string): string {
  return `msg:${messageId}`;
}

export async function cacheMessage(
  conversationId: string,
  messageId: string,
  messageData: any,
  createdAt: number
): Promise<void> {
  const client = getRedisClient();
  if (!client?.isOpen) return;

  try {
    const hashKey = msgHashKey(messageId);
    const sortedKey = msgSortedSetKey(conversationId);

    const multi = client.multi();
    multi.setEx(hashKey, MSG_CACHE_TTL, JSON.stringify(messageData));
    multi.zAdd(sortedKey, { score: createdAt, value: messageId });
    multi.zCard(sortedKey);

    const results = await multi.exec();
    const total = results?.[2] as number | undefined;

    if (total && total > MAX_MSGS_PER_CONV) {
      const removeCount = total - MAX_MSGS_PER_CONV;
      const oldest = await (client as any).zPopMin(sortedKey, removeCount) as Array<{ value: string; score: number }>;
      if (oldest?.length) {
        const keysToDelete = oldest.map((o: any) => msgHashKey(o.value));
        if (keysToDelete.length > 0) {
          await client.del(keysToDelete);
        }
      }
    }
  } catch (error) {
    console.error('Redis cacheMessage error:', error);
  }
}

export async function getCachedMessages(
  conversationId: string,
  limit: number = 50,
  before?: string
): Promise<{ messageIds: string[]; hasMore: boolean }> {
  const client = getRedisClient();
  if (!client?.isOpen) return { messageIds: [], hasMore: false };

  try {
    const safeLimit = Math.min(limit, 100);
    const key = msgSortedSetKey(conversationId);

    const total = await client.zCard(key);
    if (total === 0) return { messageIds: [], hasMore: false };

    const queryLimit = safeLimit + 1;
    let results: string[];

    if (before) {
      const beforeScore = Number(before);
      if (isNaN(beforeScore)) {
        console.warn('[getCachedMessages] Invalid cursor:', before);
        return { messageIds: [], hasMore: false };
      }
      results = await client.zRangeByScore(key, '-inf', String(beforeScore - 1), {
        LIMIT: { offset: 0, count: queryLimit },
      });
      results = results.reverse();
    } else {
      results = await client.zRange(key, 0, queryLimit - 1, { REV: true });
    }

    const hasMore = results.length > safeLimit;
    const messageIds = hasMore ? results.slice(0, safeLimit) : results;

    return { messageIds, hasMore };
  } catch (error) {
    console.error('Redis getCachedMessages error:', error);
    return { messageIds: [], hasMore: false };
  }
}

export async function getCachedMessageData(
  messageIds: string[]
): Promise<Map<string, any>> {
  const client = getRedisClient();
  if (!client?.isOpen) return new Map();

  try {
    const keys = messageIds.map(msgHashKey);
    const values = await client.mGet(keys);
    const map = new Map<string, any>();
    values.forEach((val, i) => {
      if (val) {
        try {
          map.set(messageIds[i], JSON.parse(val));
        } catch {
          // skip parse errors
        }
      }
    });
    return map;
  } catch (error) {
    console.error('Redis getCachedMessageData error:', error);
    return new Map();
  }
}

export async function invalidateConversationCache(
  conversationId: string
): Promise<void> {
  const client = getRedisClient();
  if (!client?.isOpen) return;

  try {
    const key = msgSortedSetKey(conversationId);
    const messageIds = await client.zRange(key, 0, -1);
    if (messageIds.length > 0) {
      const hashKeys = messageIds.map(msgHashKey);
      await client.del([key, ...hashKeys]);
    } else {
      await client.del(key);
    }
  } catch (error) {
    console.error('Redis invalidateConversationCache error:', error);
  }
}

export async function updateCachedMessageDeleted(
  conversationId: string,
  messageId: string,
  deletedAt: number
): Promise<void> {
  const client = getRedisClient();
  if (!client?.isOpen) return;

  try {
    const hashKey = msgHashKey(messageId);
    const existing = await client.get(hashKey);
    if (existing) {
      const data = JSON.parse(existing);
      data.isDeleted = true;
      data.deletedAt = deletedAt;
      data.body = '';
      data.attachments = [];
      await client.setEx(hashKey, MSG_CACHE_TTL, JSON.stringify(data));
    }
  } catch (error) {
    console.error('Redis updateCachedMessageDeleted error:', error);
  }
}

export function isMessageCursorInRange(
  cursor: string | undefined,
  oldestMsgCreatedAt: number | null
): boolean {
  if (!cursor) return true;
  if (!oldestMsgCreatedAt) return false;
  return new Date(cursor).getTime() > oldestMsgCreatedAt;
}
