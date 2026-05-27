import { ensureMember, pinRepo } from '../shared/message-context';

export async function unpinMessage(
  userId: string,
  conversationId: string,
  createdAt: number,
  messageId: string
) {
  void createdAt;
  const member = await ensureMember(userId, conversationId);

  const pin = await pinRepo().findOneBy({ messageId, conversationId });
  if (!pin) {
    return { success: true, message: 'Message already unpinned' };
  }

  const isAdmin = member.role === 'OWNER' || member.role === 'ADMIN';
  if (!isAdmin && pin.pinnedBy !== userId) {
    throw new Error('Only pin owner or admin can unpin');
  }

  await pinRepo().delete({ id: pin.id });
  return { success: true, message: 'Unpinned' };
}
