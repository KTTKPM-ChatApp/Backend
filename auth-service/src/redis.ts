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

const PRESENCE_SET_KEY = 'presence:users:online';

export async function setUserOnline(userId: string): Promise<void> {
  if (!isRedisConnected()) return;
  try {
    await redisClient!.sAdd(PRESENCE_SET_KEY, userId);
    await redisClient!.expire(PRESENCE_SET_KEY, 120);
  } catch {}
}

export async function setUserOffline(userId: string): Promise<void> {
  if (!isRedisConnected()) return;
  try {
    await redisClient!.sRem(PRESENCE_SET_KEY, userId);
  } catch {}
}

export async function isUserOnline(userId: string): Promise<boolean> {
  if (!isRedisConnected()) return false;
  try {
    return await redisClient!.sIsMember(PRESENCE_SET_KEY, userId);
  } catch {
    return false;
  }
}

export async function getOnlineUserIds(): Promise<string[]> {
  if (!isRedisConnected()) return [];
  try {
    return await redisClient!.sMembers(PRESENCE_SET_KEY);
  } catch {
    return [];
  }
}
