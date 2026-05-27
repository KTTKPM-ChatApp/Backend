import { fetchUserInfo } from '../../auth-client';
import {
  ensureMember,
  messageRepo,
  toEpoch,
} from '../shared/message-context';

export async function editMessage(
  userId: string,
  conversationId: string,
  createdAt: number,
  messageId: string,
  newContent: string
) {
  void createdAt;
  await ensureMember(userId, conversationId);
  const msg = await messageRepo().findOneBy({ id: messageId, conversationId });
  if (!msg) throw new Error('Message not found');
  if (msg.senderId !== userId) throw new Error('You can only edit your own messages');

  const trimmed = newContent.trim();
  if (!trimmed) throw new Error('Content cannot be empty');

  msg.content = trimmed;
  msg.isEdited = true;
  msg.editedAt = new Date();
  await messageRepo().save(msg);

  let senderName = 'Nguoi dung';
  try {
    const senderInfo = await fetchUserInfo(msg.senderId);
    if (senderInfo) senderName = senderInfo.displayName;
  } catch (err) {
    console.warn('[editMessage] senderName lookup failed:', err);
  }

  return {
    ...msg,
    messageId: msg.id,
    body: msg.content,
    senderName,
    createdAt: toEpoch(msg.createdAt),
    editedAt: msg.editedAt ? toEpoch(msg.editedAt) : undefined,
  };
}
