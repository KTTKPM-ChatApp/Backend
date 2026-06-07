import { v4 as uuid } from 'uuid';
import {
  AppDataSource,
  Conversation,
  ConversationCall,
  ConversationInvite,
  ConversationMember,
  ConversationPoll,
  ConversationSettings,
  ConversationSummary,
  GroupCallSession,
  GroupCallParticipant,
  Message,
  PollVote,
  UserPinnedConversation,
} from '../../db';
import { fetchUsersInfo } from '../../auth-client';
import { notifySystemEvent } from '../../notifier';
import { cacheDeletePattern } from '../../redis';

export const conversationRepo = () => AppDataSource.getRepository(Conversation);
export const memberRepo = () => AppDataSource.getRepository(ConversationMember);
export const messageRepo = () => AppDataSource.getRepository(Message);
export const summaryRepo = () => AppDataSource.getRepository(ConversationSummary);
export const inviteRepo = () => AppDataSource.getRepository(ConversationInvite);
export const pollRepo = () => AppDataSource.getRepository(ConversationPoll);
export const voteRepo = () => AppDataSource.getRepository(PollVote);
export const callRepo = () => AppDataSource.getRepository(ConversationCall);
export const groupSessionRepo = () => AppDataSource.getRepository(GroupCallSession);
export const groupParticipantRepo = () => AppDataSource.getRepository(GroupCallParticipant);
export const settingsRepo = () => AppDataSource.getRepository(ConversationSettings);
export const pinnedRepo = () => AppDataSource.getRepository(UserPinnedConversation);

export { ConversationMember, UserPinnedConversation };

export function invalidateConversationListCache(memberIds: string[]) {
  memberIds.forEach(memberId => {
    cacheDeletePattern(`convlist:${memberId}:*`).catch(() => {});
  });
}

export async function resolveDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  const map = await fetchUsersInfo(userIds);
  const result = new Map<string, string>();
  for (const id of userIds) {
    result.set(id, map.get(id)?.displayName ?? id);
  }
  return result;
}

export async function persistAndNotifySystemEvent(
  conversationId: string,
  senderId: string,
  systemEventType: string,
  metadata: Record<string, any>
) {
  const messageId = uuid();
  const now = new Date();

  const message = messageRepo().create({
    id: messageId,
    conversationId,
    senderId,
    contentType: 'SYSTEM',
    content: '',
    type: 'system',
    messageType: 'system',
    systemEventType,
    metadata,
    createdAt: now,
    updatedAt: now,
  });
  await messageRepo().save(message);

  notifySystemEvent({
    messageId,
    conversationId,
    senderId,
    systemEventType,
    metadata,
  }, now.toISOString()).catch(() => {});
}

export function buildDirectKey(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join(':');
}

export async function checkMembership(userId: string, conversationId: string): Promise<ConversationMember> {
  const member = await memberRepo().findOneBy({ conversationId, userId });
  if (!member) {
    throw new Error('You are not a member of this conversation');
  }
  return member;
}

export async function checkAdminPermission(userId: string, conversationId: string): Promise<ConversationMember> {
  const member = await checkMembership(userId, conversationId);
  if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
    throw new Error('Only admin or owner can perform this action');
  }
  return member;
}

export async function checkOwnerPermission(userId: string, conversationId: string): Promise<ConversationMember> {
  const member = await checkMembership(userId, conversationId);
  if (member.role !== 'OWNER') {
    throw new Error('Only owner can perform this action');
  }
  return member;
}

export function formatLastMessagePreview(msg: Message): string {
  if (msg.content && msg.content.trim()) return msg.content;
  if (!msg.attachments || msg.attachments.length === 0) return msg.content || '';
  const types = msg.attachments.map(a => a.type);
  if (types.includes('image')) return 'Da gui 1 anh';
  if (types.includes('video')) return 'Da gui 1 video';
  if (types.includes('audio')) return 'Da gui 1 tin nhan thoai';
  return 'Da gui 1 tep dinh kem';
}
