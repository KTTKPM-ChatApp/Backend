import { fetchUserInfo } from '../../auth-client';
import { messageRepo, toEpoch } from '../shared/message-context';

export async function lookupMessageById(messageId: string) {
  const message = await messageRepo().findOneBy({ id: messageId });
  if (!message) return null;

  let senderName = 'Nguoi dung';
  try {
    const senderInfo = await fetchUserInfo(message.senderId);
    if (senderInfo) senderName = senderInfo.displayName;
  } catch (err) {
    console.warn('[lookupMessageById] senderName lookup failed:', err);
  }

  return {
    ...message,
    messageId: message.id,
    body: message.content,
    senderName,
    createdAt: toEpoch(message.createdAt),
  };
}
