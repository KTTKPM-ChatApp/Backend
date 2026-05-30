import { MemoryStore, Options, Store, type ClientRateLimitInfo } from 'express-rate-limit';
import { getRedisClient } from './redis';

export class RedisBackedRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;

  private windowMs = 60_000;
  private readonly fallback = new MemoryStore();

  constructor(prefix: string) {
    this.prefix = `rate-limit:${prefix}:`;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const client = getRedisClient();
    if (!client) {
      return this.fallback.get(key);
    }

    let rawHits: string | null;
    let ttlMs: number;
    try {
      const redisKey = this.redisKey(key);
      [rawHits, ttlMs] = await Promise.all([
        client.get(redisKey),
        client.pTTL(redisKey),
      ]);
    } catch {
      return this.fallback.get(key);
    }

    if (!rawHits) return undefined;

    return {
      totalHits: Number(rawHits),
      resetTime: new Date(Date.now() + Math.max(ttlMs, 0)),
    };
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const client = getRedisClient();
    if (!client) {
      return this.fallback.increment(key);
    }

    try {
      const redisKey = this.redisKey(key);
      const totalHits = await client.incr(redisKey);

      if (totalHits === 1) {
        await client.pExpire(redisKey, this.windowMs);
      }

      let ttlMs = await client.pTTL(redisKey);
      if (ttlMs < 0) {
        await client.pExpire(redisKey, this.windowMs);
        ttlMs = this.windowMs;
      }

      return {
        totalHits,
        resetTime: new Date(Date.now() + ttlMs),
      };
    } catch {
      return this.fallback.increment(key);
    }
  }

  async decrement(key: string): Promise<void> {
    const client = getRedisClient();
    if (!client) {
      await this.fallback.decrement(key);
      return;
    }

    try {
      const redisKey = this.redisKey(key);
      const totalHits = await client.decr(redisKey);
      if (totalHits <= 0) {
        await client.del(redisKey);
      }
    } catch {
      await this.fallback.decrement(key);
    }
  }

  async resetKey(key: string): Promise<void> {
    const client = getRedisClient();
    if (!client) {
      await this.fallback.resetKey(key);
      return;
    }

    try {
      await client.del(this.redisKey(key));
    } catch {
      await this.fallback.resetKey(key);
    }
  }

  shutdown(): void {
    this.fallback.shutdown();
  }

  private redisKey(key: string): string {
    return `${this.prefix}${key}`;
  }
}
