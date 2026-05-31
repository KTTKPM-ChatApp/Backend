import { createClient, RedisClientType } from 'redis';
import { config } from './config';

let redisClient: RedisClientType | null = null;
let redisConnected = false;
let redisConnectStarted = false;
let loggedFallback = false;

function redisReconnectDelay(retries: number): number {
  const baseMs = 1000;
  const maxMs = config.redis.reconnectMaxDelayMs;
  const exponential = Math.min(maxMs, baseMs * 2 ** Math.max(0, retries - 1));
  const jitter = Math.floor(Math.random() * Math.min(baseMs, exponential) * 0.25);
  return exponential + jitter;
}

export function startRedisConnection(): void {
  if (redisConnectStarted) return;
  redisConnectStarted = true;

  redisClient = createClient({
    socket: {
      host: config.redis.host,
      port: config.redis.port,
      connectTimeout: 3000,
      reconnectStrategy: redisReconnectDelay,
    },
    password: config.redis.password || undefined,
  });

  redisClient.on('ready', () => {
    redisConnected = true;
    loggedFallback = false;
    console.log('[Redis] connected, using shared rate limit');
  });

  redisClient.on('end', () => {
    redisConnected = false;
  });

  redisClient.on('reconnecting', () => {
    redisConnected = false;
  });

  redisClient.on('error', (err) => {
    redisConnected = false;
    if (!loggedFallback) {
      loggedFallback = true;
      console.warn(`[Redis] unavailable, using in-memory rate limit fallback: ${err.message}`);
    }
  });

  void redisClient.connect().catch((err) => {
    redisConnected = false;
    if (!loggedFallback) {
      loggedFallback = true;
      console.warn(`[Redis] initial connection failed, using in-memory rate limit fallback: ${err.message}`);
    }
  });
}

export function isRedisConnected(): boolean {
  return redisConnected && redisClient?.isOpen === true;
}

export function getRedisClient(): RedisClientType | null {
  return isRedisConnected() ? redisClient : null;
}

export async function closeRedis(): Promise<void> {
  if (!redisClient) return;

  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  } finally {
    redisClient = null;
    redisConnected = false;
    redisConnectStarted = false;
  }
}
