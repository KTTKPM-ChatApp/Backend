import { fetchUserInfo } from '../../auth-client';
import { ConversationFeatures, ConversationPermissions, ConversationPolicies } from '../../db';
import {
  checkMembership,
  checkOwnerPermission,
  conversationRepo,
  invalidateConversationListCache,
  memberRepo,
  persistAndNotifySystemEvent,
  pinnedRepo,
  settingsRepo,
} from '../shared/conversation-context';

export async function markAsRead(
  userId: string,
  conversationId: string
) {
  await checkMembership(userId, conversationId);

  await memberRepo().update({ conversationId, userId }, {
    lastReadAt: new Date(),
  });

  return { message: 'Conversation marked as read' };
}

export async function pinConversation(
  userId: string,
  conversationId: string
) {
  await checkMembership(userId, conversationId);

  const existing = await pinnedRepo().findOneBy({ userId, conversationId });
  if (existing) {
    throw new Error('Conversation is already pinned');
  }

  await pinnedRepo().save(pinnedRepo().create({
    userId,
    conversationId,
    pinnedAt: new Date(),
  }));

  invalidateConversationListCache([userId]);

  return { message: 'Conversation pinned' };
}

export async function unpinConversation(
  userId: string,
  conversationId: string
) {
  await checkMembership(userId, conversationId);

  const existing = await pinnedRepo().findOneBy({ userId, conversationId });
  if (!existing) {
    throw new Error('Conversation is not pinned');
  }

  await pinnedRepo().delete({ userId, conversationId });

  invalidateConversationListCache([userId]);

  return { message: 'Conversation unpinned' };
}

export async function updateGroupSettings(
  userId: string,
  conversationId: string,
  permissions?: ConversationPermissions,
  policies?: ConversationPolicies,
  features?: ConversationFeatures
) {
  await checkOwnerPermission(userId, conversationId);

  const existing = await settingsRepo().findOneBy({ conversationId });

  const updateData: any = {};
  if (permissions !== undefined) updateData.permissions = permissions;
  if (policies !== undefined) updateData.policies = policies;
  if (features !== undefined) updateData.features = features;

  if (existing) {
    await settingsRepo().update({ conversationId }, updateData);
  } else {
    await settingsRepo().save(settingsRepo().create({
      conversationId,
      ...updateData,
    }));
  }

  return settingsRepo().findOneBy({ conversationId });
}

export async function disbandGroup(
  userId: string,
  conversationId: string
) {
  await checkOwnerPermission(userId, conversationId);

  const conversation = await conversationRepo().findOneBy({ id: conversationId });
  if (conversation?.type === 'DIRECT') {
    throw new Error('Cannot disband direct conversation');
  }

  const allMembers = await memberRepo().findBy({ conversationId });
  const allMemberIds = allMembers.map(m => m.userId);

  const disbandName = (await fetchUserInfo(userId))?.displayName ?? userId;

  persistAndNotifySystemEvent(
    conversationId,
    userId,
    'GROUP_DISBANDED',
    { disbanded_by_name: disbandName }
  );

  invalidateConversationListCache(allMemberIds);

  await memberRepo().delete({ conversationId });
  await conversationRepo().delete({ id: conversationId });

  return { message: 'Group disbanded successfully' };
}
