import axios from 'axios';
import { AppDataSource, User } from '../db';
import { config } from '../config';

const userRepo = () => AppDataSource.getRepository(User);

interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  email: string;
  isActive: boolean;
  bio?: string | null;
  gender?: string | null;
  phone?: string | null;
}

/**
 * Fetch all users from auth-service and upsert into local `users` table.
 * Called once on chat-service startup.
 */
export async function syncAllUsers(): Promise<void> {
  try {
    const res = await axios.get<{ success: boolean; data: AuthUser[] }>(
      `${config.authService.url}/users/all`,
      { timeout: 10000 }
    );

    const users = res.data?.data;
    if (!users || users.length === 0) {
      console.log('[UserSync] No users returned from auth-service');
      return;
    }

    const batch = users.map(u => ({
      id: u.id,
      username: u.username || u.id,
      displayName: u.displayName || u.username || u.id,
      email: u.email || '',
      avatarUrl: u.avatarUrl || undefined,
      isActive: u.isActive !== false,
      bio: u.bio || undefined,
      gender: u.gender || undefined,
      phone: u.phone || undefined,
    }));

    await Promise.allSettled(
      batch.map(u => userRepo().upsert(u as any, ['id']))
    );

    console.log(`[UserSync] Synced ${batch.length} users from auth-service`);
  } catch (error) {
    console.warn('[UserSync] Failed to fetch users from auth-service, will lazy-sync:', error);
  }
}

/**
 * Ensure a user exists in the local `users` table.
 * If not found locally, fetch from auth-service and cache.
 */
export async function ensureUser(userId: string): Promise<void> {
  const existing = await userRepo().findOneBy({ id: userId });
  if (existing) return;

  try {
    const res = await axios.get<AuthUser>(`${config.authService.url}/users/${userId}`, { timeout: 3000 });
    const u = res.data;
    if (!u || !u.id) return;

    await userRepo().upsert({
      id: u.id,
      username: u.username || u.id,
      displayName: u.displayName || u.username || u.id,
      email: u.email || '',
      avatarUrl: u.avatarUrl || undefined,
      isActive: u.isActive !== false,
      bio: u.bio || undefined,
      gender: u.gender || undefined,
      phone: u.phone || undefined,
    } as any, ['id']);

    console.log(`[UserSync] Lazy-synced user: ${u.id} (${u.displayName})`);
  } catch (error) {
    console.warn(`[UserSync] Failed to fetch user ${userId}:`, error);
  }
}
