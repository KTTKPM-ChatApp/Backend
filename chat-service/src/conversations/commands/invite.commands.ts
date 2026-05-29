import { v4 as uuid } from 'uuid';
import { notifyNewConversation } from '../../notifier';
import {
  checkAdminPermission,
  conversationRepo,
  invalidateConversationListCache,
  inviteRepo,
  memberRepo,
  summaryRepo,
} from '../shared/conversation-context';

export async function sendInvites(
  userId: string,
  conversationId: string,
  userIds: string[],
  message?: string,
  expiresInHours: number = 24
) {
  await checkAdminPermission(userId, conversationId);

  const conversation = await conversationRepo().findOneBy({ id: conversationId });
  if (conversation?.type === 'DIRECT') {
    throw new Error('Cannot invite to direct conversation');
  }

  const existingMembers = await memberRepo().findBy({ conversationId });
  const existingMemberIds = new Set(existingMembers.map(m => m.userId));

  const uniqueUserIds = [...new Set(userIds)];
  const validUserIds = uniqueUserIds.filter(id => !existingMemberIds.has(id));

  if (validUserIds.length === 0) {
    throw new Error('All users are already members');
  }

  if (validUserIds.length > 50) {
    throw new Error('Cannot invite more than 50 users at once');
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  const invites = validUserIds.map(targetUserId =>
    inviteRepo().create({
      id: uuid(),
      conversationId,
      invitedBy: userId,
      userId: targetUserId,
      message,
      expiresAt,
    })
  );

  await inviteRepo().save(invites);

  return {
    message: `Sent ${invites.length} invites successfully`,
    invites: invites.map(inv => ({ id: inv.id, userId: inv.userId })),
  };
}

export async function acceptInvite(
  userId: string,
  conversationId: string,
  inviteId: string
) {
  const invite = await inviteRepo().findOneBy({ id: inviteId, conversationId, userId });

  if (!invite) {
    throw new Error('Invite not found');
  }

  if (invite.status !== 'PENDING') {
    throw new Error('Invite is no longer pending');
  }

  if (invite.expiresAt < new Date()) {
    throw new Error('Invite has expired');
  }

  const existingMember = await memberRepo().findOneBy({ conversationId, userId });
  if (existingMember) {
    throw new Error('You are already a member of this conversation');
  }

  await memberRepo().save(memberRepo().create({
    conversationId,
    userId,
    role: 'MEMBER',
    joinedAt: new Date(),
  }));

  const conversation = await conversationRepo().findOneBy({ id: conversationId });

  await summaryRepo().upsert({
    userId,
    conversationId,
    conversationType: conversation?.type || 'GROUP',
    conversationTitle: conversation?.title || undefined,
    conversationAvatar: conversation?.avatarUrl || undefined,
  }, ['userId', 'conversationId']);

  invalidateConversationListCache([userId]);

  if (conversation) {
    notifyNewConversation({
      conversationId,
      type: conversation.type,
      createdBy: conversation.createdBy,
      memberIds: [userId],
      title: conversation.title,
    }).catch((err: any) => console.error('[acceptInvite] notifyNewConversation error:', err));
  }

  await inviteRepo().update(inviteId, {
    status: 'ACCEPTED',
    respondedAt: new Date(),
  });

  return { message: 'Invite accepted successfully' };
}

export async function rejectInvite(
  userId: string,
  conversationId: string,
  inviteId: string
) {
  const invite = await inviteRepo().findOneBy({ id: inviteId, conversationId, userId });

  if (!invite) {
    throw new Error('Invite not found');
  }

  if (invite.status !== 'PENDING') {
    throw new Error('Invite is no longer pending');
  }

  await inviteRepo().update(inviteId, {
    status: 'REJECTED',
    respondedAt: new Date(),
  });

  return { message: 'Invite rejected' };
}

export async function cancelInvite(
  userId: string,
  conversationId: string,
  inviteId: string
) {
  await checkAdminPermission(userId, conversationId);

  const invite = await inviteRepo().findOneBy({ id: inviteId, conversationId });

  if (!invite) {
    throw new Error('Invite not found');
  }

  if (invite.status !== 'PENDING') {
    throw new Error('Cannot cancel non-pending invite');
  }

  if (invite.invitedBy !== userId) {
    throw new Error('Only the inviter can cancel this invite');
  }

  await inviteRepo().update(inviteId, { status: 'CANCELLED' });

  return { message: 'Invite cancelled' };
}
