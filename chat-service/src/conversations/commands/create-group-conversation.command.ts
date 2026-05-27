import { v4 as uuid } from 'uuid';
import { notifyNewConversation } from '../../notifier';
import {
  conversationRepo,
  invalidateConversationListCache,
  memberRepo,
  settingsRepo,
  summaryRepo,
} from '../shared/conversation-context';

export async function createGroupConversation(
  createdBy: string,
  name: string,
  memberIds: string[],
  avatarUrl?: string,
  description?: string
) {
  const uniqueMembers = [...new Set(memberIds.filter(id => id !== createdBy))];

  if (!name?.trim()) {
    throw new Error('Group conversation requires a name');
  }
  if (uniqueMembers.length < 2) {
    throw new Error('Group conversation requires at least 2 other participants');
  }
  if (uniqueMembers.length > 100) {
    throw new Error('Group conversation cannot have more than 100 members');
  }

  const conversation = conversationRepo().create({
    id: uuid(),
    type: 'GROUP',
    title: name.trim(),
    createdBy,
    avatarUrl,
    description: description?.trim() || undefined,
  });
  await conversationRepo().save(conversation);

  const allMemberIds = [createdBy, ...uniqueMembers];
  await memberRepo().save(allMemberIds.map(userId =>
    memberRepo().create({
      conversationId: conversation.id,
      userId,
      role: userId === createdBy ? 'OWNER' : 'MEMBER',
      joinedAt: new Date(),
    })
  ));

  await settingsRepo().save(settingsRepo().create({
    conversationId: conversation.id,
    permissions: {
      canAddMembers: true,
      canRemoveMembers: true,
      canCreatePolls: true,
      canStartCall: true,
      canSendMessage: true,
    },
    policies: {
      maxMembers: 100,
      inviteApproval: false,
      messageRetention: 30,
    },
    features: {
      polls: true,
      calls: true,
      fileSharing: true,
      reactions: true,
    },
  }));

  const members = await memberRepo().findBy({ conversationId: conversation.id });

  await Promise.allSettled(
    allMemberIds.map(userId =>
      summaryRepo().upsert({
        userId,
        conversationId: conversation.id,
        conversationType: 'GROUP',
        conversationTitle: name.trim(),
        conversationAvatar: avatarUrl || undefined,
      }, ['userId', 'conversationId'])
    )
  );

  invalidateConversationListCache(allMemberIds);

  notifyNewConversation({
    conversationId: conversation.id,
    type: 'GROUP',
    createdBy,
    memberIds: allMemberIds,
    title: name.trim(),
  }).catch((err: any) => console.error('[createGroupConversation] notifyNewConversation error:', err));

  return {
    ...conversation,
    members,
  };
}
