import { v4 as uuid } from 'uuid';
import { fetchUserInfo, fetchUsersInfo } from '../../auth-client';
import {
  buildDirectKey,
  conversationRepo,
  invalidateConversationListCache,
  memberRepo,
  summaryRepo,
} from '../shared/conversation-context';

export async function createDirectConversation(
  createdBy: string,
  participantId: string
) {
  if (participantId === createdBy) {
    throw new Error('Cannot create conversation with yourself');
  }

  const directKey = buildDirectKey(createdBy, participantId);
  const existing = await conversationRepo().findOneBy({ directKey });

  if (existing) {
    const existingMembers = await memberRepo().findBy({ conversationId: existing.id });

    if (existingMembers.length === 0) {
      await conversationRepo().delete(existing.id);
    } else {
      const userInfoMap = await fetchUsersInfo(existingMembers.map(m => m.userId));
      const enrichedMembers = existingMembers.map(m => ({
        userId: m.userId,
        displayName: userInfoMap.get(m.userId)?.displayName ?? null,
        role: m.role,
      }));
      const otherMemberId = existingMembers.find(m => m.userId !== createdBy)?.userId;
      let name = existing.title || 'Cuoc tro chuyen';
      if (otherMemberId) {
        const otherUserInfo = userInfoMap.get(otherMemberId);
        name = otherUserInfo?.displayName ?? otherUserInfo?.username ?? name;
      }
      return {
        ...existing,
        name,
        members: enrichedMembers,
      };
    }
  }

  const otherUserInfo = await fetchUserInfo(participantId);
  const title = otherUserInfo?.displayName ?? participantId;

  const conversation = conversationRepo().create({
    id: uuid(),
    type: 'DIRECT',
    createdBy,
    directKey,
    title,
  });
  await conversationRepo().save(conversation);

  const memberIds = [createdBy, participantId];

  for (const userId of memberIds) {
    const memberEntity = memberRepo().create({
      conversationId: conversation.id,
      userId,
      joinedAt: new Date(),
    });
    try {
      await memberRepo().save(memberEntity);
    } catch (err) {
      console.error('[createDirectConversation] Error saving member:', userId, err);
      throw err;
    }
  }

  const members = await memberRepo()
    .createQueryBuilder('m')
    .where('m.conversation_id = :convId', { convId: conversation.id })
    .getMany();
  const userInfoMap = await fetchUsersInfo(members.map(m => m.userId));
  const enrichedMembers = members.map(m => ({
    userId: m.userId,
    displayName: userInfoMap.get(m.userId)?.displayName ?? null,
    role: m.role,
  }));

  await Promise.allSettled(
    memberIds.map(userId =>
      summaryRepo().upsert({
        userId,
        conversationId: conversation.id,
        conversationType: 'DIRECT',
        conversationTitle: title,
      }, ['userId', 'conversationId'])
    )
  );

  invalidateConversationListCache(memberIds);

  return {
    ...conversation,
    name: title,
    members: enrichedMembers,
  };
}
