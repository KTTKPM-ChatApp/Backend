import { BaseClient } from './base-client';

export interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email?: string;
  phone?: string;
  bio?: string;
  gender?: string;
}

interface RawUserResponse {
  id?: string;
  username?: string;
  displayName?: string;
  display_name?: string;
  avatarUrl?: string;
  avatar_url?: string;
  email?: string;
  phone?: string;
  bio?: string;
  gender?: string;
}

export class AuthClientService extends BaseClient {
  private cache = new Map<string, { data: UserInfo; expiry: number }>();
  private static readonly CACHE_TTL = 300_000; // 5 minutes

  constructor(private readonly authBaseUrl: string) {
    super();
  }

  protected get baseUrl(): string {
    return this.authBaseUrl;
  }

  async getUser(userId: string): Promise<UserInfo | null> {
    const cached = this.cache.get(userId);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    try {
      const res = await this.request<RawUserResponse>({
        method: 'GET',
        path: `/users/${userId}`,
        timeout: 3000,
      });

      const info: UserInfo = {
        id: res.id ?? userId,
        username: res.username ?? userId,
        displayName: res.displayName || res.display_name || userId,
        avatarUrl: res.avatarUrl || res.avatar_url || null,
        email: res.email,
        phone: res.phone,
        bio: res.bio,
        gender: res.gender,
      };

      this.cache.set(userId, { data: info, expiry: Date.now() + AuthClientService.CACHE_TTL });
      return info;
    } catch {
      return null;
    }
  }

  async getUsers(userIds: string[]): Promise<Map<string, UserInfo>> {
    const unique = [...new Set(userIds)];
    const map = new Map<string, UserInfo>();

    // Check cache first
    const uncached: string[] = [];
    for (const id of unique) {
      const cached = this.cache.get(id);
      if (cached && Date.now() < cached.expiry) {
        map.set(id, cached.data);
      } else {
        uncached.push(id);
      }
    }

    if (uncached.length === 0) return map;

    // Batch fetch uncached users
    try {
      const res = await this.request<{ success: boolean; data: RawUserResponse[] }>({
        method: 'GET',
        path: `/users/batch?ids=${uncached.join(',')}`,
        timeout: 5000,
      });

      if (res?.data) {
        for (const raw of res.data) {
          const id = raw.id ?? '';
          if (!id) continue;
          const info: UserInfo = {
            id,
            username: raw.username ?? id,
            displayName: raw.displayName || raw.display_name || id,
            avatarUrl: raw.avatarUrl || raw.avatar_url || null,
            email: raw.email,
            phone: raw.phone,
            bio: raw.bio,
            gender: raw.gender,
          };
          this.cache.set(id, { data: info, expiry: Date.now() + AuthClientService.CACHE_TTL });
          map.set(id, info);
        }
      }
    } catch {
      // Fallback: fetch individually
      const results = await Promise.allSettled(uncached.map(id => this.getUser(id)));
      uncached.forEach((id, i) => {
        if (results[i].status === 'fulfilled' && results[i].value) {
          map.set(id, results[i].value);
        }
      });
    }

    return map;
  }

  clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId);
    } else {
      this.cache.clear();
    }
  }
}
