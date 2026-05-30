import { fetchUsersInfo } from '../../auth-client';
import {
  detectContentType,
  ensureMember,
  messageRepo,
  normalizeAttachment,
  parseAttachments,
  toEpoch,
} from '../shared/message-context';

export async function searchMessages(
  userId: string,
  conversationId: string,
  query?: string,
  senderId?: string,
  from?: number,
  to?: number,
  fileType?: string
) {
  await ensureMember(userId, conversationId);

  const qb = messageRepo()
    .createQueryBuilder('m')
    .where('m.conversation_id = :conversationId', { conversationId })
    .orderBy('m.created_at', 'DESC')
    .addOrderBy('m.id', 'DESC')
    .limit(100);

  if (query) {
    qb.andWhere('m.content LIKE :q', { q: `%${query}%` });
  }

  if (senderId) {
    qb.andWhere('m.sender_id = :senderId', { senderId });
  }

  if (from) {
    qb.andWhere('m.created_at >= :fromDate', { fromDate: new Date(from) });
  }

  if (to) {
    qb.andWhere('m.created_at <= :toDate', { toDate: new Date(to) });
  }

  const rows = await qb.getMany();
  const filtered = fileType
    ? rows.filter((row) => {
        const attachments = parseAttachments(row.attachments);
        if (fileType === 'images') {
          return attachments.some((a: any) => a?.type === 'image' || String(a?.contentType || '').startsWith('image/'));
        }
        if (fileType === 'video') {
          return attachments.some((a: any) => a?.type === 'video' || String(a?.contentType || '').startsWith('video/'));
        }
        if (fileType === 'files') {
          return attachments.some((a: any) => a?.type === 'document' || a?.type === 'file' || (!String(a?.contentType || '').startsWith('image/') && !String(a?.contentType || '').startsWith('video/')));
        }
        return true;
      })
    : rows;

  const searchSenderIds = [...new Set(filtered.map(m => m.senderId))];
  let searchSenderMap = new Map<string, string>();
  if (searchSenderIds.length > 0) {
    try {
      const sendersInfo = await fetchUsersInfo(searchSenderIds);
      sendersInfo.forEach((info, id) => {
        searchSenderMap.set(id, info.displayName);
      });
    } catch (err) {
      console.warn('[searchMessages] senderName lookup failed:', err);
    }
  }

  return filtered.map((msg) => {
    const isDeleted = msg.isDeleted || false;
    const attachments = isDeleted ? [] : parseAttachments(msg.attachments).map(normalizeAttachment).filter(Boolean);
    return {
      ...msg,
      messageId: msg.id,
      body: isDeleted ? '' : msg.content,
      contentType: detectContentType(isDeleted ? '' : msg.content, attachments),
      attachments,
      senderName: searchSenderMap.get(msg.senderId) || 'Nguoi dung',
      createdAt: toEpoch(msg.createdAt),
      isDeleted,
      deletedAt: msg.deletedAt ? toEpoch(msg.deletedAt) : null,
      replyToMessageId: msg.replyToId || null,
    };
  });
}
