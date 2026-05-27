import { config } from './config';
import { AuthClientService } from '../../shared/clients/auth-client';
import { cacheGet, cacheSet, cacheDelete } from './redis';
export type { UserInfo } from '../../shared/clients/auth-client';

const authClient = new AuthClientService(config.authService.url);

const AUTH_CACHE_TTL = 300; // 5 minutes
const AUTH_CACHE_PREFIX = 'user:';

function redisKey(userId: string) {
  return `${AUTH_CACHE_PREFIX}${userId}`;
}

export async function fetchUserInfo(userId: string) {
  const key = redisKey(userId);
  const cached = await cacheGet<import('../../shared/clients/auth-client').UserInfo>(key);
  if (cached) return cached;

  const info = await authClient.getUser(userId);
  if (info) {
    await cacheSet(key, info, AUTH_CACHE_TTL);
  }
  return info;
}

export async function fetchUsersInfo(userIds: string[]) {
  const unique = [...new Set(userIds)];
  const results = await Promise.allSettled(unique.map(id => fetchUserInfo(id)));
  const map = new Map<string, import('../../shared/clients/auth-client').UserInfo>();
  unique.forEach((id, i) => {
    if (results[i].status === 'fulfilled' && results[i].value) {
      map.set(id, results[i].value);
    }
  });
  return map;
}

export function clearUserCache(userId?: string) {
  authClient.clearCache(userId);
  if (userId) {
    cacheDelete(redisKey(userId)).catch(() => {});
  }
}
