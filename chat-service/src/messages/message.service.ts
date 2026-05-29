import { v4 as uuid } from 'uuid';
import {
  AppDataSource,
  ConversationMember,
  Message,
  MessageForward,
  MessagePin,
  MessageReaction,
} from '../db';
import { fetchUsersInfo, fetchUserInfo } from '../auth-client';
import { getCachedMessages, getCachedMessageData } from '../redis-messages';

const memberRepo = () => AppDataSource.getRepository(ConversationMember);
const messageRepo = () => AppDataSource.getRepository(Message);
const pinRepo = () => AppDataSource.getRepository(MessagePin);
const reactionRepo = () => AppDataSource.getRepository(MessageReaction);
const forwardRepo = () => AppDataSource.getRepository(MessageForward);

function parseAttachments(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function normalizeAttachment(raw: any): any {
  if (!raw) return null;
  const contentType = raw.contentType || raw.mimeType || raw.content_type || '';
  const inferredType = raw.type ||
    (contentType.startsWith('image/') ? 'image' :
     contentType.startsWith('video/') ? 'video' :
     contentType.startsWith('audio/') ? 'audio' : 'document');
  return {
    key: raw.key || raw.publicId || '',
    url: raw.url || '',
    type: inferredType,
    name: raw.name || raw.fileName || raw.originalName || 'file',
    size: raw.size || 0,
    contentType,
    thumbnailUrl: raw.thumbnailUrl || raw.thumbnail_key || null,
    publicId: raw.publicId || raw.key || null,
    resourceType: raw.resourceType || null,
  };
}

function detectContentType(content: string, attachments: any[]): string {
  if (!content && attachments.length > 0) {
    const hasMedia = attachments.some(a => a.type === 'image' || a.type === 'video');
    const hasFiles = attachments.some(a => a.type === 'document' || a.type === 'file' || a.type === 'audio');
    if (hasMedia && hasFiles) return 'MIXED';
    if (hasMedia) return 'MEDIA';
    if (hasFiles) return 'FILE';
    return 'MEDIA';
  }
  if (content && attachments.length > 0) return 'MIXED';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  if (urlRegex.test(content) && !attachments.length) return 'LINK';
  return 'TEXT';
}

async function ensureMember(userId: string, conversationId: string) {
  const member = await memberRepo().findOneBy({ userId, conversationId });
  if (!member) {
    throw new Error('You are not a member of this conversation');
  }
  return member;
}

function toEpoch(value: Date | string | number) {
  return new Date(value).getTime();
}

export async function listMessages(
  userId: string,
  conversationId: string,
  cursor?: string,
  limit: number = 50
) {
  await ensureMember(userId, conversationId);

  const safeLimit = Math.max(1, Math.min(limit, 100));

  // Fast path: try Redis read model first
  const cached = await getCachedMessages(conversationId, safeLimit, cursor);
  if (cached.messageIds.length > 0) {
    const cachedData = await getCachedMessageData(cached.messageIds);
    const cachedItems: any[] = [];

    for (const id of cached.messageIds) {
      const data = cachedData.get(id);
      if (!data) continue;
      const attachments = (data.attachments || []).map(normalizeAttachment).filter(Boolean);
<<<<<<< HEAD
=======
      const isDeletedFromCache = Boolean(data.isDeleted);
>>>>>>> origin/main
      cachedItems.push({
        messageId: data.messageId,
        conversationId,
        senderId: data.senderId,
        senderName: data.senderName || 'Người dùng',
<<<<<<< HEAD
        body: data.body || '',
        contentType: data.contentType || detectContentType(data.body || '', attachments),
        attachments,
        createdAt: data.createdAt,
        isDeleted: false,
=======
        body: isDeletedFromCache ? '' : (data.body || ''),
        contentType: data.contentType || detectContentType(isDeletedFromCache ? '' : (data.body || ''), attachments),
        attachments: isDeletedFromCache ? [] : attachments,
        createdAt: data.createdAt,
        isDeleted: isDeletedFromCache,
        deletedAt: data.deletedAt || null,
>>>>>>> origin/main
        replyToMessageId: data.replyToMessageId || null,
        replyTo: null,
      });
    }

    // Only serve from cache if we have items and more remain in cache (hasMore).
    // When cache exhausted, fall through to DB — cache may be incomplete (only recent messages).
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
<<<<<<< HEAD
=======
            const isReplyDeleted = r.isDeleted || false;
>>>>>>> origin/main
            repliedMsg.replyTo = {
              messageId: r.id,
              senderId: r.senderId,
              senderName: senderMap.get(r.senderId) || 'Người dùng',
<<<<<<< HEAD
              body: r.content,
              attachments: parseAttachments(r.attachments).map(normalizeAttachment).filter(Boolean),
              isDeleted: false,
=======
              body: isReplyDeleted ? '' : r.content,
              attachments: isReplyDeleted ? [] : parseAttachments(r.attachments).map(normalizeAttachment).filter(Boolean),
              isDeleted: isReplyDeleted,
>>>>>>> origin/main
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

  // Fallback: MariaDB query
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

  // Collect all replyToIds to batch-fetch replied messages
  const replyToIds = [...new Set(items.map(m => m.replyToId).filter(Boolean))] as string[];
  const repliedMessagesMap = new Map<string, any>();

  console.log(`[listMessages] ${items.length} messages, ${replyToIds.length} have replyToId`);

  if (replyToIds.length > 0) {
    const repliedMsgs = await messageRepo()
      .createQueryBuilder('r')
      .where('r.id IN (:...ids)', { ids: replyToIds })
      .getMany();

    console.log(`[listMessages] fetched ${repliedMsgs.length} replied messages`);

    // Batch-fetch senders of replied messages
    const senderIds = [...new Set(repliedMsgs.map(r => r.senderId))];
    let senderMap = new Map<string, string>();

    if (senderIds.length > 0) {
      try {
        const sendersInfo = await fetchUsersInfo(senderIds);
        sendersInfo.forEach((info, id) => {
          senderMap.set(id, info.displayName);
        });
        console.log(`[listMessages] fetched ${sendersInfo.size} sender names`);
      } catch (err) {
        console.warn('[listMessages] senderName lookup failed:', err);
      }
    }

    for (const r of repliedMsgs) {
<<<<<<< HEAD
      const repliedAttachments = parseAttachments(r.attachments).map(normalizeAttachment).filter(Boolean);
=======
      const isReplyDeleted = r.isDeleted || false;
      const repliedAttachments = isReplyDeleted ? [] : parseAttachments(r.attachments).map(normalizeAttachment).filter(Boolean);
>>>>>>> origin/main
      repliedMessagesMap.set(r.id, {
        messageId: r.id,
        senderId: r.senderId,
        senderName: senderMap.get(r.senderId) || 'Người dùng',
<<<<<<< HEAD
        body: r.content,
        attachments: repliedAttachments,
        isDeleted: false,
=======
        body: isReplyDeleted ? '' : r.content,
        attachments: repliedAttachments,
        isDeleted: isReplyDeleted,
>>>>>>> origin/main
      });
    }
  }

  // Batch-fetch sender names for ALL messages
  const allSenderIds = [...new Set(items.map(m => m.senderId))];
  let senderNameMap = new Map<string, string>();

  if (allSenderIds.length > 0) {
    try {
      const sendersInfo = await fetchUsersInfo(allSenderIds);
      sendersInfo.forEach((info, id) => {
        senderNameMap.set(id, info.displayName);
      });
      console.log(`[listMessages] fetched ${sendersInfo.size} sender names for all messages`);
    } catch (err) {
      console.warn('[listMessages] senderName lookup for all messages failed:', err);
    }
  }

  const normalized = items
    .reverse()
    .map((msg) => {
<<<<<<< HEAD
      const rawAttachments = parseAttachments(msg.attachments);
      const attachments = rawAttachments.map(normalizeAttachment).filter(Boolean);
      const contentType = detectContentType(msg.content, attachments);
      return {
        ...msg,
        messageId: msg.id,
        body: msg.content,
=======
      const isDeleted = msg.isDeleted || false;
      const rawAttachments = parseAttachments(msg.attachments);
      const attachments = isDeleted ? [] : rawAttachments.map(normalizeAttachment).filter(Boolean);
      const contentType = detectContentType(isDeleted ? '' : msg.content, attachments);
      return {
        ...msg,
        messageId: msg.id,
        body: isDeleted ? '' : msg.content,
>>>>>>> origin/main
        contentType,
        attachments,
        senderName: senderNameMap.get(msg.senderId) || 'Người dùng',
        createdAt: toEpoch(msg.createdAt),
<<<<<<< HEAD
        isDeleted: false,
=======
        isDeleted,
        deletedAt: msg.deletedAt ? toEpoch(msg.deletedAt) : null,
>>>>>>> origin/main
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

  let senderName = 'Người dùng';
  try {
    const senderInfo = await fetchUserInfo(message.senderId);
    if (senderInfo) senderName = senderInfo.displayName;
  } catch (err) {
    console.warn('[getMessageDetail] senderName lookup failed:', err);
  }

<<<<<<< HEAD
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
=======
  const isDeleted = message.isDeleted || false;
  const attachments = isDeleted ? [] : parseAttachments(message.attachments).map(normalizeAttachment).filter(Boolean);
  return {
    ...message,
    messageId: message.id,
    body: isDeleted ? '' : message.content,
    contentType: detectContentType(isDeleted ? '' : message.content, attachments),
    attachments,
    senderName,
    createdAt: toEpoch(message.createdAt),
    isDeleted,
    deletedAt: message.deletedAt ? toEpoch(message.deletedAt) : null,
>>>>>>> origin/main
    replyToMessageId: message.replyToId || null,
  };
}

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

  // Batch-fetch sender names
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
<<<<<<< HEAD
    const attachments = parseAttachments(msg.attachments).map(normalizeAttachment).filter(Boolean);
    return {
      ...msg,
      messageId: msg.id,
      body: msg.content,
      contentType: detectContentType(msg.content, attachments),
      attachments,
      senderName: searchSenderMap.get(msg.senderId) || 'Người dùng',
      createdAt: toEpoch(msg.createdAt),
      isDeleted: false,
=======
    const isDeleted = msg.isDeleted || false;
    const attachments = isDeleted ? [] : parseAttachments(msg.attachments).map(normalizeAttachment).filter(Boolean);
    return {
      ...msg,
      messageId: msg.id,
      body: isDeleted ? '' : msg.content,
      contentType: detectContentType(isDeleted ? '' : msg.content, attachments),
      attachments,
      senderName: searchSenderMap.get(msg.senderId) || 'Người dùng',
      createdAt: toEpoch(msg.createdAt),
      isDeleted,
      deletedAt: msg.deletedAt ? toEpoch(msg.deletedAt) : null,
>>>>>>> origin/main
      replyToMessageId: msg.replyToId || null,
    };
  });
}

export async function forwardMessage(
  userId: string,
  forwardId: string,
  sourceMessageId: string,
  targets: Array<{ message_id: string; conversation_id: string }>
) {
  if (!forwardId) throw new Error('forward_id is required');
  if (!sourceMessageId) throw new Error('source_message_id is required');
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error('targets is required');
  }
  if (targets.length > 20) throw new Error('Maximum 20 targets');

  const existing = await forwardRepo().findOneBy({ forwardId, senderId: userId });
  if (existing) {
    return {
      message: 'Forward already processed',
      forwardId,
      duplicated: true,
      targets: existing.targets,
    };
  }

  const source = await messageRepo().findOneBy({ id: sourceMessageId });
  if (!source) throw new Error('Source message not found');
  await ensureMember(userId, source.conversationId);

  const uniqueTargets = Array.from(
    new Map(targets.map((t) => [t.conversation_id, t])).values()
  );

  for (const target of uniqueTargets) {
    await ensureMember(userId, target.conversation_id);
  }

  const inserts = uniqueTargets.map((target) =>
    messageRepo().create({
      id: target.message_id || uuid(),
      conversationId: target.conversation_id,
      senderId: userId,
      contentType: source.contentType,
      content: source.content,
      attachments: source.attachments || [],
      replyToId: undefined,
      isEdited: false,
    })
  );

  await messageRepo().save(inserts);

  await forwardRepo().save(
    forwardRepo().create({
      id: uuid(),
      forwardId,
      senderId: userId,
      sourceMessageId,
      targets: uniqueTargets,
    })
  );

  return {
    message: 'Forward success',
    forwardId,
    duplicated: false,
    count: inserts.length,
  };
}

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
    }
  };
}

export async function unpinMessage(
  userId: string,
  conversationId: string,
  createdAt: number,
  messageId: string
) {
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

export async function listPinnedMessages(userId: string, conversationId: string, limit: number = 20) {
  await ensureMember(userId, conversationId);
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const pins = await pinRepo()
    .createQueryBuilder('p')
    .where('p.conversation_id = :conversationId', { conversationId })
    .orderBy('p.pinned_at', 'DESC')
    .limit(safeLimit)
    .getMany();

  if (pins.length === 0) return [];
  const ids = pins.map((p) => p.messageId);
  const messages = await messageRepo()
    .createQueryBuilder('m')
    .where('m.id IN (:...ids)', { ids })
    .getMany();
  const map = new Map(messages.map((m) => [m.id, m]));

  return pins.map((pin) => {
    const msg = map.get(pin.messageId);
    return {
      ...pin,
      message: msg
        ? {
            ...msg,
            messageId: msg.id,
            body: msg.content,
            createdAt: toEpoch(msg.createdAt),
          }
        : null,
    };
  });
}

export async function getMessageReactions(userId: string, messageId: string) {
  const msg = await messageRepo().findOneBy({ id: messageId });
  if (!msg) throw new Error('Message not found');
  await ensureMember(userId, msg.conversationId);
  const reactions = await reactionRepo().findBy({ messageId });

  const grouped = new Map<string, { count: number; userIds: string[] }>();
  reactions.forEach((r) => {
    const prev = grouped.get(r.emoji) || { count: 0, userIds: [] };
    prev.count += 1;
    prev.userIds.push(r.userId);
    grouped.set(r.emoji, prev);
  });

  return Array.from(grouped.entries()).map(([emoji, data]) => ({
    emoji,
    count: data.count,
    userIds: data.userIds,
  }));
}

export async function editMessage(
  userId: string,
  conversationId: string,
  createdAt: number,
  messageId: string,
  newContent: string
) {
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

  let senderName = 'Người dùng';
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
    editedAt: toEpoch(msg.editedAt),
  };
}

export async function lookupMessageById(messageId: string) {
  const message = await messageRepo().findOneBy({ id: messageId });
  if (!message) return null;

  let senderName = 'Người dùng';
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

export async function deleteMessage(
  userId: string,
  conversationId: string,
  createdAt: number,
  messageId: string
) {
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

  const { publishMessageDeleted } = await import('../rabbitmq');
  const { updateCachedMessageDeleted } = await import('../redis-messages');
  const allMembers = await memberRepo().find({ where: { conversationId } });
  const allMemberIds = allMembers.map(m => m.userId);

  updateCachedMessageDeleted(conversationId, messageId, Date.now());
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
