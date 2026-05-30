import { createClient, RedisClientType } from 'redis';
import { config } from './config';

let redisClient: RedisClientType | null = null;
let redisLastError: string | null = null;

function redisReconnectDelay(retries: number) {
  const baseMs = 1000;
  const maxMs = config.redis.reconnectMaxDelayMs;
  const exponential = Math.min(maxMs, baseMs * 2 ** Math.max(0, retries - 1));
  const jitter = Math.floor(Math.random() * Math.min(baseMs, exponential) * 0.25);
  return exponential + jitter;
}

export async function connectRedis(): Promise<void> {
  try {
    redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        connectTimeout: 3000,
        reconnectStrategy: redisReconnectDelay,
      },
      password: config.redis.password || undefined,
    });

    redisClient.on('error', (err) => {
      redisLastError = err?.message || 'Unknown Redis error';
      console.error('Redis Client Error:', err.message);
    });

    redisClient.on('ready', () => {
      console.log('Redis connected successfully');
      redisLastError = null;
    });

    await redisClient.connect();
  } catch (error: any) {
    redisLastError = error?.message || 'Unknown Redis error';
    console.error('Failed to connect to Redis:', error?.message);
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
    redisClient = null;
    console.log('Redis connection closed');
  }
}

export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

export function getRedisStatus(): { connected: boolean; lastError: string | null } {
  return {
    connected: redisClient?.isOpen ?? false,
    lastError: redisLastError,
  };
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redisClient?.isOpen) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis cache get error:', error);
    return null;
  }
}

export async function cacheSet(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
  if (!redisClient?.isOpen) return;
  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error('Redis cache set error:', error);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  if (!redisClient?.isOpen) return;
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('Redis cache delete error:', error);
  }
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  if (!redisClient?.isOpen) return;
  try {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const result = await redisClient.scan(Number(cursor), { MATCH: pattern, COUNT: 500 });
      cursor = String(result.cursor);
      keys.push(...result.keys);
    } while (cursor !== '0');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error('Redis cache delete pattern error:', error);
  }
}

export async function cacheMGet(keys: string[]): Promise<(string | null)[]> {
  if (!redisClient?.isOpen || keys.length === 0) return [];
  try {
    return await redisClient.mGet(keys);
  } catch (error) {
    console.error('Redis cache mget error:', error);
    return [];
  }
}

export async function cachePipelineGet(keys: string[]): Promise<(any | null)[]> {
  if (!redisClient?.isOpen || keys.length === 0) return [];
  try {
    const pipeline = redisClient.multi();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();
    return results.map(r => {
      if (!r) return null;
      try { return JSON.parse(r as string); } catch { return r; }
    });
  } catch (error) {
    console.error('Redis pipeline get error:', error);
    return keys.map(() => null);
  }
}

// Search cache helpers
export const SEARCH_CACHE_TTL = 60; // 1 minute
export const CONVERSATION_CACHE_TTL = 300; // 5 minutes
export const USER_PRESENCE_TTL = 30; // 30 seconds

export function getSearchCacheKey(userId: string, query: string): string {
  return `search:${userId}:${query.toLowerCase().trim()}`;
}

export function getConversationCacheKey(conversationId: string): string {
  return `conv:${conversationId}`;
}

export function getUserPresenceKey(userId: string): string {
  return `presence:${userId}`;
}
