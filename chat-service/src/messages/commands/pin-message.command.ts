import { v4 as uuid } from 'uuid';
import {
  ensureMember,
  messageRepo,
  pinRepo,
  toEpoch,
} from '../shared/message-context';

export async function pinMessage(
  userId: string,
  conversationId: string,
  createdAt: number,
  messageId: string
) {
  const member = await ensureMember(userId, conversationId);
  const message = await messageRepo().findOneBy({ id: messageId, conversationId });
  if (!message) throw new Error('Message not found');
  if (Math.abs(toEpoch(message.createdAt) - createdAt) > 60000) {
    throw new Error('Message timestamp mismatch');
  }

  const existing = await pinRepo().findOneBy({ messageId, conversationId });
  if (existing) return existing;

  const pin = pinRepo().create({
    id: uuid(),
    messageId,
    conversationId,
    pinnedBy: member.userId,
  });
  await pinRepo().save(pin);

  return {
    id: pin.id,
    messageId: pin.messageId,
    conversationId: pin.conversationId,
    pinnedBy: pin.pinnedBy,
    pinnedAt: pin.pinnedAt,
    message: {
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      attachments: message.attachments,
      createdAt: toEpoch(message.createdAt),
    },
  };
}
