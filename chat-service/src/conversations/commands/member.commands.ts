import { fetchUserInfo } from '../../auth-client';
import { notifyNewConversation } from '../../notifier';
import {
  checkMembership,
  checkOwnerPermission,
  conversationRepo,
  invalidateConversationListCache,
  memberRepo,
  persistAndNotifySystemEvent,
  resolveDisplayNames,
  settingsRepo,
  summaryRepo,
} from '../shared/conversation-context';

export async function addMembers(
  userId: string,
  conversationId: string,
  memberIds: string[]
) {
  const currentMember = await checkMembership(userId, conversationId);

  const conversation = await conversationRepo().findOneBy({ id: conversationId });
  if (conversation?.type === 'DIRECT') {
    throw new Error('Cannot add members to direct conversation');
  }

  const settings = await settingsRepo().findOneBy({ conversationId });
  const canAddMembers =
    currentMember.role === 'OWNER' ||
    currentMember.role === 'ADMIN' ||
    settings?.permissions?.canAddMembers !== false;

  if (!canAddMembers) {
    throw new Error('You do not have permission to add members');
  }

  const maxMembers = settings?.policies?.maxMembers || 100;

  const existingMembers = await memberRepo().findBy({ conversationId });
  if (existingMembers.length + memberIds.length > maxMembers) {
    throw new Error(`Cannot exceed maximum of ${maxMembers} members`);
  }

  const uniqueMembers = [...new Set(memberIds)];
  const existingMemberIds = new Set(existingMembers.map(m => m.userId));
  const newMemberIds = uniqueMembers.filter(id => !existingMemberIds.has(id));

  if (newMemberIds.length === 0) {
    throw new Error('All users are already members');
  }

  await memberRepo().save(newMemberIds.map(userId =>
    memberRepo().create({ conversationId, userId, role: 'MEMBER', joinedAt: new Date() })
  ));

  await Promise.allSettled(
    newMemberIds.map(memberId =>
      summaryRepo().upsert({
        userId: memberId,
        conversationId,
        conversationType: conversation?.type || 'GROUP',
        conversationTitle: conversation?.title || undefined,
        conversationAvatar: conversation?.avatarUrl || undefined,
      }, ['userId', 'conversationId'])
    )
  );

  const allMemberIds = [...existingMembers.map(m => m.userId), ...newMemberIds];
  invalidateConversationListCache(allMemberIds);

  const displayNames = await resolveDisplayNames([userId, ...newMemberIds]);

  if (conversation) {
    notifyNewConversation({
      conversationId,
      type: conversation.type,
      createdBy: userId,
      memberIds: newMemberIds,
      title: conversation.title,
    }).catch((err: any) => console.error('[addMembers] notifyNewConversation error:', err));
  }

  persistAndNotifySystemEvent(
    conversationId,
    userId,
    'MEMBER_ADDED',
    {
      added_by_name: displayNames.get(userId)!,
      added_members: newMemberIds.map((id: string) => ({ full_name: displayNames.get(id!) })),
    }
  );

  return { message: `Added ${newMemberIds.length} members successfully` };
}

export async function removeMember(
  userId: string,
  conversationId: string,
  memberId: string
) {
  const member = await memberRepo().findOneBy({ conversationId, userId });
  const targetMember = await memberRepo().findOneBy({ conversationId, userId: memberId });

  if (!member || !targetMember) {
    throw new Error('Member not found');
  }

  const canRemove =
    userId === memberId ||
    member.role === 'OWNER' ||
    (member.role === 'ADMIN' && targetMember.role !== 'OWNER');

  if (!canRemove) {
    throw new Error('You cannot remove this member');
  }

  const allMembers = await memberRepo().findBy({ conversationId });
  if (allMembers.length === 1) {
    throw new Error('Cannot remove the last member. Use disband instead.');
  }

  await memberRepo().delete({ conversationId, userId: memberId });

  await summaryRepo().delete({ userId: memberId, conversationId }).catch(() => {});
  invalidateConversationListCache(allMembers.map(m => m.userId));

  const removerName = (await fetchUserInfo(userId))?.displayName ?? userId;
  const removedName = (await fetchUserInfo(memberId))?.displayName ?? memberId;

  persistAndNotifySystemEvent(
    conversationId,
    userId,
    'MEMBER_REMOVED',
    {
      removed_by_name: removerName,
      removed_user_name: removedName,
      removed_user_id: memberId,
    }
  );

  return { message: 'Member removed successfully' };
}

export async function leaveConversation(
  userId: string,
  conversationId: string
) {
  const member = await checkMembership(userId, conversationId);

  const allMembers = await memberRepo().findBy({ conversationId });
  if (member.role === 'OWNER') {
    if (allMembers.length > 1) {
      throw new Error('Owner cannot leave group with other members. Transfer ownership first.');
    }
  }

  await memberRepo().delete({ conversationId, userId });

  await summaryRepo().delete({ userId, conversationId }).catch(() => {});
  invalidateConversationListCache(allMembers.map(m => m.userId));

  const leftName = (await fetchUserInfo(userId))?.displayName ?? userId;

  persistAndNotifySystemEvent(
    conversationId,
    userId,
    'MEMBER_LEFT',
    { user_name: leftName, user_id: userId }
  );

  return { message: 'Left conversation successfully' };
}

export async function transferOwnership(
  userId: string,
  conversationId: string,
  newOwnerId: string
) {
  await checkOwnerPermission(userId, conversationId);

  if (userId === newOwnerId) {
    throw new Error('Cannot transfer ownership to yourself');
  }

  const newOwner = await memberRepo().findOneBy({ conversationId, userId: newOwnerId });
  if (!newOwner) {
    throw new Error('New owner not found');
  }

  await memberRepo().update(
    { conversationId, userId },
    { role: 'ADMIN' }
  );

  await memberRepo().update(
    { conversationId, userId: newOwnerId },
    { role: 'OWNER' }
  );

  const ownerNames = await resolveDisplayNames([userId, newOwnerId]);

  persistAndNotifySystemEvent(
    conversationId,
    userId,
    'OWNER_TRANSFERRED',
    {
      previous_owner_name: ownerNames.get(userId)!,
      new_owner_name: ownerNames.get(newOwnerId)!,
    }
  );

  return { message: 'Ownership transferred successfully' };
}

export async function updateMemberRole(
  userId: string,
  conversationId: string,
  memberId: string,
  newRole: 'ADMIN' | 'MEMBER'
) {
  await checkOwnerPermission(userId, conversationId);

  if (userId === memberId) {
    throw new Error('Cannot change your own role');
  }

  const targetMember = await memberRepo().findOneBy({ conversationId, userId: memberId });
  if (!targetMember) {
    throw new Error('Member not found');
  }

  if (targetMember.role === 'OWNER') {
    throw new Error('Cannot change owner role');
  }

  await memberRepo().update({ conversationId, userId: memberId }, { role: newRole });

  const updatedMember = await memberRepo().findOneBy({ conversationId, userId: memberId });

  const roleNames = await resolveDisplayNames([userId, memberId]);

  persistAndNotifySystemEvent(
    conversationId,
    userId,
    'ROLE_CHANGED',
    {
      updated_by_name: roleNames.get(userId)!,
      target_user_name: roleNames.get(memberId)!,
      new_role: newRole === 'ADMIN' ? 'co_owner' : 'member',
    }
  );

  return updatedMember;
}

export async function updateUserSettings(
  userId: string,
  conversationId: string,
  nickname?: string,
  isMuted?: boolean
) {
  await checkMembership(userId, conversationId);

  const updateData: any = {};
  if (nickname !== undefined) updateData.nickname = nickname?.trim();
  if (isMuted !== undefined) updateData.isMuted = isMuted;

  await memberRepo().update({ conversationId, userId }, updateData);

  invalidateConversationListCache([userId]);

  return memberRepo().findOneBy({ conversationId, userId });
}
