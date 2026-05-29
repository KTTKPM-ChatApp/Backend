import { fetchUserInfo } from '../../auth-client';
import {
  checkAdminPermission,
  conversationRepo,
  invalidateConversationListCache,
  memberRepo,
  persistAndNotifySystemEvent,
  summaryRepo,
} from '../shared/conversation-context';

export async function updateConversation(
  userId: string,
  conversationId: string,
  name?: string,
  avatarUrl?: string
) {
  await checkAdminPermission(userId, conversationId);

  const updateData: any = {};
  if (name !== undefined) updateData.title = name.trim();
  if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

  await conversationRepo().update(conversationId, updateData);

  const conversation = await conversationRepo().findOneBy({ id: conversationId });

  const members = await memberRepo().findBy({ conversationId });
  const memberIds = members.map(m => m.userId);

  if (name !== undefined || avatarUrl !== undefined) {
    await Promise.allSettled(
      memberIds.map(memberId =>
        summaryRepo().upsert({
          userId: memberId,
          conversationId,
          conversationTitle: name !== undefined ? name.trim() : undefined,
          conversationAvatar: avatarUrl !== undefined ? avatarUrl : undefined,
        }, ['userId', 'conversationId'])
      )
    );

    invalidateConversationListCache(memberIds);

    const updaterName = (await fetchUserInfo(userId))?.displayName ?? userId;
    const events: Array<{ type: string; metadata: Record<string, any> }> = [];

    if (name !== undefined) {
      events.push({
        type: 'CONVERSATION_UPDATED',
        metadata: {
          updated_by_name: updaterName,
          updated_by_id: userId,
          field: 'name',
          new_value: name.trim(),
        },
      });
    }

    if (avatarUrl !== undefined) {
      events.push({
        type: 'CONVERSATION_UPDATED',
        metadata: {
          updated_by_name: updaterName,
          updated_by_id: userId,
          field: 'avatar',
          new_value: avatarUrl,
        },
      });
    }

    for (const event of events) {
      persistAndNotifySystemEvent(conversationId, userId, event.type, event.metadata)
        .catch((err: any) => console.error('[updateConversation] persistAndNotifySystemEvent error:', err));
    }
  }

  return {
    ...conversation,
    members,
  };
}
