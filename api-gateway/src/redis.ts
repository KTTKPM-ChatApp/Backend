import { createClient, RedisClientType } from 'redis';
import { config } from './config';

let redisClient: RedisClientType | null = null;
let redisConnected = false;

const inMemoryStore = new Map<string, Set<string>>();

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

    redisClient.on('error', () => {
      redisConnected = false;
    });

    redisClient.on('ready', () => {
      redisConnected = true;
    });

    redisClient.on('end', () => {
      redisConnected = false;
    });

    await redisClient.connect();
    redisConnected = true;
  } catch {
    redisConnected = false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
    redisClient = null;
    redisConnected = false;
  }
}

export function isRedisConnected(): boolean {
  return redisConnected && redisClient?.isOpen === true;
}

export async function presenceAdd(userId: string, socketId: string): Promise<void> {
  if (isRedisConnected()) {
    try {
      await redisClient!.sAdd(`presence:${userId}`, socketId);
      await redisClient!.expire(`presence:${userId}`, 60);
    } catch {
      fallbackPresenceAdd(userId, socketId);
    }
  } else {
    fallbackPresenceAdd(userId, socketId);
  }
}

export async function presenceRemove(userId: string, socketId: string): Promise<void> {
  if (isRedisConnected()) {
    try {
      await redisClient!.sRem(`presence:${userId}`, socketId);
      const count = await redisClient!.sCard(`presence:${userId}`);
      if (count === 0) {
        await redisClient!.del(`presence:${userId}`);
      }
    } catch {
      fallbackPresenceRemove(userId, socketId);
    }
  } else {
    fallbackPresenceRemove(userId, socketId);
  }
}

export async function presenceHeartbeat(userId: string, socketId: string): Promise<void> {
  await presenceAdd(userId, socketId);
}

export async function isUserOnline(userId: string): Promise<boolean> {
  if (isRedisConnected()) {
    try {
      const count = await redisClient!.sCard(`presence:${userId}`);
      return count > 0;
    } catch {
      return fallbackIsUserOnline(userId);
    }
  }
  return fallbackIsUserOnline(userId);
}

export async function getConnectedSocketIds(userId: string): Promise<string[]> {
  if (isRedisConnected()) {
    try {
      return await redisClient!.sMembers(`presence:${userId}`);
    } catch {
      return fallbackGetConnectedSocketIds(userId);
    }
  }
  return fallbackGetConnectedSocketIds(userId);
}

export async function getOnlineUserIds(): Promise<string[]> {
  if (isRedisConnected()) {
    try {
      const keys = await redisClient!.keys('presence:*');
      return keys.map((k: string) => k.replace('presence:', ''));
    } catch {
      return fallbackGetOnlineUserIds();
    }
  }
  return fallbackGetOnlineUserIds();
}

function fallbackPresenceAdd(userId: string, socketId: string): void {
  if (!inMemoryStore.has(userId)) {
    inMemoryStore.set(userId, new Set());
  }
  inMemoryStore.get(userId)!.add(socketId);
}

function fallbackPresenceRemove(userId: string, socketId: string): void {
  const sockets = inMemoryStore.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    inMemoryStore.delete(userId);
  }
}

function fallbackIsUserOnline(userId: string): boolean {
  return inMemoryStore.has(userId) && (inMemoryStore.get(userId)?.size ?? 0) > 0;
}

function fallbackGetConnectedSocketIds(userId: string): string[] {
  return Array.from(inMemoryStore.get(userId) ?? []);
}

function fallbackGetOnlineUserIds(): string[] {
  return Array.from(inMemoryStore.keys());
}
