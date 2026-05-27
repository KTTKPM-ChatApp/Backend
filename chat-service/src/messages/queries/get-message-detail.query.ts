import { fetchUserInfo } from '../../auth-client';
import {
  detectContentType,
  ensureMember,
  messageRepo,
  normalizeAttachment,
  parseAttachments,
  toEpoch,
} from '../shared/message-context';

export async function getMessageDetail(
  userId: string,
  conversationId: string,
  createdAt: number,
  messageId: string
) {
  await ensureMember(userId, conversationId);

  const message = await messageRepo().findOneBy({ id: messageId, conversationId });
  if (!message) throw new Error('Message not found');

  if (Math.abs(toEpoch(message.createdAt) - createdAt) > 60000) {
    throw new Error('Message timestamp mismatch');
  }

  let senderName = 'Nguoi dung';
  try {
    const senderInfo = await fetchUserInfo(message.senderId);
    if (senderInfo) senderName = senderInfo.displayName;
  } catch (err) {
    console.warn('[getMessageDetail] senderName lookup failed:', err);
  }

  const attachments = parseAttachments(message.attachments).map(normalizeAttachment).filter(Boolean);
  return {
    ...message,
    messageId: message.id,
    body: message.content,
    contentType: detectContentType(message.content, attachments),
    attachments,
    senderName,
    createdAt: toEpoch(message.createdAt),
    isDeleted: false,
    replyToMessageId: message.replyToId || null,
  };
}
