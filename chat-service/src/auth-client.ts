import { config } from './config';
import { AuthClientService } from '../shared/clients/auth-client';
export type { UserInfo } from '../shared/clients/auth-client';

const authClient = new AuthClientService(config.authService.url);

export async function fetchUserInfo(userId: string) {
  return authClient.getUser(userId);
}

export async function fetchUsersInfo(userIds: string[]) {
  return authClient.getUsers(userIds);
}

export function clearUserCache(userId?: string) {
  authClient.clearCache(userId);
}
