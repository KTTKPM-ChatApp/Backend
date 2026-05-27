import {
  ensureMember,
  messageRepo,
  pinRepo,
} from '../shared/message-context';

export async function deleteMessage(
  userId: string,
  conversationId: string,
  createdAt: number,
  messageId: string
) {
  void createdAt;
  await ensureMember(userId, conversationId);

  const message = await messageRepo().findOneBy({
    id: messageId,
    conversationId,
  });

  if (!message) {
    throw new Error('Message not found');
  }

  if (message.senderId !== userId) {
    throw new Error('You can only delete your own messages');
  }

  await messageRepo().delete({ id: messageId });
  await pinRepo().delete({ messageId, conversationId });

  return { success: true, messageId };
}
