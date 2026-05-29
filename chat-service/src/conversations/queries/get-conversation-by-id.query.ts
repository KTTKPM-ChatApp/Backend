import { fetchUsersInfo } from '../../auth-client';
import {
  checkMembership,
  conversationRepo,
  formatLastMessagePreview,
  memberRepo,
  messageRepo,
} from '../shared/conversation-context';

export async function getConversationById(userId: string, conversationId: string) {
  await checkMembership(userId, conversationId);

  const conversation = await conversationRepo().findOneBy({ id: conversationId });
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const members = await memberRepo().findBy({ conversationId });
  const userInfoMap = await fetchUsersInfo(members.map(m => m.userId));
  const enrichedMembers = members.map(m => ({
    userId: m.userId,
    displayName: userInfoMap.get(m.userId)?.displayName ?? null,
    avatarUrl: userInfoMap.get(m.userId)?.avatarUrl ?? null,
    role: m.role,
  }));

  let lastMessage: { id: string; content: string; createdAt: Date; senderId: string; senderName: string } | undefined;
  if (conversation.lastMessageId) {
    const msg = await messageRepo().findOneBy({ id: conversation.lastMessageId });
    if (msg) {
      const userInfoMap2 = await fetchUsersInfo([msg.senderId]);
      const senderInfo = userInfoMap2.get(msg.senderId);
      lastMessage = {
        id: msg.id,
        content: formatLastMessagePreview(msg),
        createdAt: msg.createdAt,
        senderId: msg.senderId,
        senderName: senderInfo?.displayName || 'Nguoi dung',
      };
    }
  }

  return {
    ...conversation,
    members: enrichedMembers,
    lastMessage,
  };
}
