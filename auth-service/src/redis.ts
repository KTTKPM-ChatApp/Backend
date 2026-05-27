import { createClient, RedisClientType } from 'redis';
import { config } from './config';

let redisClient: RedisClientType | null = null;
let redisConnected = false;

export async function connectRedis(): Promise<void> {
  try {
    redisClient = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        connectTimeout: 3000,
        reconnectStrategy: false,
      },
      password: config.redis.password || undefined,
    });

    redisClient.on('error', () => { redisConnected = false; });
    redisClient.on('connect', () => { redisConnected = true; });
    redisClient.on('end', () => { redisConnected = false; });

    await redisClient.connect();
    redisConnected = true;
  } catch {
    redisConnected = false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisConnected = false;
  }
}

function isRedisConnected(): boolean {
  return redisConnected && redisClient?.isOpen === true;
}

export async function setUserOnline(userId: string): Promise<void> {
  if (!isRedisConnected()) return;
  try {
    await redisClient!.sAdd('presence:online', userId);
    await redisClient!.expire('presence:online', 120);
  } catch {}
}

export async function setUserOffline(userId: string): Promise<void> {
  if (!isRedisConnected()) return;
  try {
    await redisClient!.sRem('presence:online', userId);
  } catch {}
}

export async function isUserOnline(userId: string): Promise<boolean> {
  if (!isRedisConnected()) return false;
  try {
    return await redisClient!.sIsMember('presence:online', userId);
  } catch {
    return false;
  }
}

export async function getOnlineUserIds(): Promise<string[]> {
  if (!isRedisConnected()) return [];
  try {
    return await redisClient!.sMembers('presence:online');
  } catch {
    return [];
  }
}
