import axios from 'axios';
import { config } from './config';

const cache = new Map<string, { displayName: string; username: string; avatarUrl: string | null }>();

export async function fetchUserInfo(userId: string) {
  if (cache.has(userId)) return cache.get(userId)!;
  try {
    const res = await axios.get(`${config.authService.url}/users/${userId}`, {
      timeout: 3000,
    });
    const user = res.data;
    const info = {
      displayName: user.displayName || user.display_name || userId,
      username: user.username || userId,
      avatarUrl: user.avatarUrl || user.avatar_url || null,
    };
    cache.set(userId, info);
    return info;
  } catch (err) {
    console.error('[fetchUserInfo] Error fetching user:', userId, err);
    return null;
  }
}

export async function fetchUsersInfo(userIds: string[]) {
  const unique = [...new Set(userIds)];
  const results = await Promise.allSettled(unique.map(fetchUserInfo));
  const map = new Map<string, { displayName: string; username: string; avatarUrl: string | null }>();
  unique.forEach((id, i) => {
    if (results[i].status === 'fulfilled' && results[i].value) {
      map.set(id, results[i].value);
    }
  });
  return map;
}
