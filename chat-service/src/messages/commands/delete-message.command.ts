import {
  ensureMember,
<<<<<<< HEAD
  messageRepo,
  pinRepo,
} from '../shared/message-context';
=======
  memberRepo,
  messageRepo,
  pinRepo,
} from '../shared/message-context';
import { publishMessageDeleted } from '../../rabbitmq';
import { updateCachedMessageDeleted } from '../../redis-messages';
>>>>>>> origin/main

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

<<<<<<< HEAD
  await messageRepo().delete({ id: messageId });
  await pinRepo().delete({ messageId, conversationId });

  return { success: true, messageId };
=======
  await messageRepo().update(
    { id: messageId },
    { content: '', attachments: [], isDeleted: true, deletedAt: new Date() }
  );

  await pinRepo().delete({ messageId, conversationId });

  updateCachedMessageDeleted(conversationId, messageId, Date.now());

  const members = await memberRepo().find({ where: { conversationId } });
  const allMemberIds = members.map(m => m.userId);

  publishMessageDeleted({
    messageId,
    conversationId,
    senderId: userId,
    senderName: '',
    deletedAt: new Date().toISOString(),
    allMemberIds,
  });

  return {
    success: true,
    messageId,
    isDeleted: true,
    deletedAt: Date.now(),
  };
>>>>>>> origin/main
}
