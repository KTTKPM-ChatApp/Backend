import { fetchUsersInfo } from '../../auth-client';
import { getCachedMessageData, getCachedMessages } from '../../redis-messages';
import {
  detectContentType,
  ensureMember,
  messageRepo,
  normalizeAttachment,
  parseAttachments,
  toEpoch,
} from '../shared/message-context';

export async function listMessages(
  userId: string,
  conversationId: string,
  cursor?: string,
  limit: number = 50
) {
  await ensureMember(userId, conversationId);

  const safeLimit = Math.max(1, Math.min(limit, 100));

  const cached = await getCachedMessages(conversationId, safeLimit, cursor);
  if (cached.messageIds.length > 0) {
    const cachedData = await getCachedMessageData(cached.messageIds);
    const cachedItems: any[] = [];

    for (const id of cached.messageIds) {
      const data = cachedData.get(id);
      if (!data) continue;
      const attachments = (data.attachments || []).map(normalizeAttachment).filter(Boolean);
      cachedItems.push({
        messageId: data.messageId,
        conversationId,
        senderId: data.senderId,
        senderName: data.senderName || 'Nguoi dung',
        body: data.isDeleted ? '' : (data.body || ''),
        contentType: data.contentType || detectContentType(data.body || '', attachments),
        attachments,
        createdAt: data.createdAt,
        isDeleted: data.isDeleted || false,
        deletedAt: data.deletedAt || null,
        replyToMessageId: data.replyToMessageId || null,
        replyTo: null,
      });
    }

    const useCache = cachedItems.length > 0 && cached.hasMore;

    if (useCache) {
      const replyToIds = [...new Set(cachedItems.map(m => m.replyToMessageId).filter(Boolean))] as string[];
      if (replyToIds.length > 0) {
        const repliedMsgs = await messageRepo()
          .createQueryBuilder('r')
          .where('r.id IN (:...ids)', { ids: replyToIds })
          .getMany();
        const senderIds = [...new Set(repliedMsgs.map(r => r.senderId))];
        let senderMap = new Map<string, string>();
        if (senderIds.length > 0) {
          try {
            const sendersInfo = await fetchUsersInfo(senderIds);
            sendersInfo.forEach((info, id) => senderMap.set(id, info.displayName));
          } catch (err) {
            console.warn('[listMessages] senderName lookup for replied failed:', err);
          }
        }
        for (const r of repliedMsgs) {
          const repliedMsg = cachedItems.find(m => m.replyToMessageId === r.id);
          if (repliedMsg) {
            const isReplyDeleted = r.isDeleted || false;
            repliedMsg.replyTo = {
              messageId: r.id,
              senderId: r.senderId,
              senderName: senderMap.get(r.senderId) || 'Nguoi dung',
              body: isReplyDeleted ? '' : r.content,
              attachments: isReplyDeleted ? [] : parseAttachments(r.attachments).map(normalizeAttachment).filter(Boolean),
              isDeleted: isReplyDeleted,
            };
          }
        }
      }

      const oldestCreatedAt = cachedItems[cachedItems.length - 1]?.createdAt;
      return {
        items: cachedItems.reverse(),
        nextCursor: cached.hasMore ? String(oldestCreatedAt) : null,
        hasMore: cached.hasMore,
      };
    }
  }

  const qb = messageRepo()
    .createQueryBuilder('m')
    .where('m.conversation_id = :conversationId', { conversationId })
    .orderBy('m.created_at', 'DESC')
    .addOrderBy('m.id', 'DESC')
    .limit(safeLimit + 1);

  if (cursor) {
    qb.andWhere('m.created_at < :cursorDate', { cursorDate: new Date(Number(cursor)) });
  }

  const rows = await qb.getMany();
  const hasMore = rows.length > safeLimit;
  const items = hasMore ? rows.slice(0, safeLimit) : rows;

  const replyToIds = [...new Set(items.map(m => m.replyToId).filter(Boolean))] as string[];
  const repliedMessagesMap = new Map<string, any>();

  if (replyToIds.length > 0) {
    const repliedMsgs = await messageRepo()
      .createQueryBuilder('r')
      .where('r.id IN (:...ids)', { ids: replyToIds })
      .getMany();

    const senderIds = [...new Set(repliedMsgs.map(r => r.senderId))];
    let senderMap = new Map<string, string>();

    if (senderIds.length > 0) {
      try {
        const sendersInfo = await fetchUsersInfo(senderIds);
        sendersInfo.forEach((info, id) => {
          senderMap.set(id, info.displayName);
        });
      } catch (err) {
        console.warn('[listMessages] senderName lookup failed:', err);
      }
    }

    for (const r of repliedMsgs) {
      const isReplyDeleted = r.isDeleted || false;
      const repliedAttachments = isReplyDeleted ? [] : parseAttachments(r.attachments).map(normalizeAttachment).filter(Boolean);
      repliedMessagesMap.set(r.id, {
        messageId: r.id,
        senderId: r.senderId,
        senderName: senderMap.get(r.senderId) || 'Nguoi dung',
        body: isReplyDeleted ? '' : r.content,
        attachments: repliedAttachments,
        isDeleted: isReplyDeleted,
      });
    }
  }

  const allSenderIds = [...new Set(items.map(m => m.senderId))];
  let senderNameMap = new Map<string, string>();

  if (allSenderIds.length > 0) {
    try {
      const sendersInfo = await fetchUsersInfo(allSenderIds);
      sendersInfo.forEach((info, id) => {
        senderNameMap.set(id, info.displayName);
      });
    } catch (err) {
      console.warn('[listMessages] senderName lookup for all messages failed:', err);
    }
  }

  const normalized = items
    .reverse()
    .map((msg) => {
      const isDeleted = msg.isDeleted || false;
      const rawAttachments = parseAttachments(msg.attachments);
      const attachments = isDeleted ? [] : rawAttachments.map(normalizeAttachment).filter(Boolean);
      const contentType = detectContentType(isDeleted ? '' : msg.content, attachments);
      return {
        ...msg,
        messageId: msg.id,
        body: isDeleted ? '' : msg.content,
        contentType,
        attachments: isDeleted ? [] : attachments,
        senderName: senderNameMap.get(msg.senderId) || 'Nguoi dung',
        createdAt: toEpoch(msg.createdAt),
        isDeleted,
        deletedAt: msg.deletedAt ? toEpoch(msg.deletedAt) : null,
        replyToMessageId: msg.replyToId || null,
        replyTo: msg.replyToId ? (repliedMessagesMap.get(msg.replyToId) ?? null) : null,
      };
    });

  const nextCursor =
    hasMore && items.length > 0 ? items[items.length - 1].createdAt.toISOString() : null;

  return {
    items: normalized,
    nextCursor,
    hasMore,
  };
}
