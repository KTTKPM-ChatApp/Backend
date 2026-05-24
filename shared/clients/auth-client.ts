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
    const results = await Promise.allSettled(unique.map(id => this.getUser(id)));
    const map = new Map<string, UserInfo>();
    unique.forEach((id, i) => {
      if (results[i].status === 'fulfilled' && results[i].value) {
        map.set(id, results[i].value);
      }
    });
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
