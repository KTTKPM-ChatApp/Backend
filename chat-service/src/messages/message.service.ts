import { v4 as uuid } from 'uuid';
import {
  AppDataSource,
  ConversationMember,
  Message,
  MessageForward,
  MessagePin,
  MessageReaction,
  User,
} from '../db';

const memberRepo = () => AppDataSource.getRepository(ConversationMember);
const messageRepo = () => AppDataSource.getRepository(Message);
const pinRepo = () => AppDataSource.getRepository(MessagePin);
const reactionRepo = () => AppDataSource.getRepository(MessageReaction);
const forwardRepo = () => AppDataSource.getRepository(MessageForward);

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
  const qb = messageRepo()
    .createQueryBuilder('m')
    .where('m.conversation_id = :conversationId', { conversationId })
    .orderBy('m.created_at', 'DESC')
    .addOrderBy('m.id', 'DESC')
    .limit(safeLimit + 1);

  if (cursor) {
    qb.andWhere('m.created_at < :cursorDate', { cursorDate: new Date(cursor) });
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
        const userRepo = AppDataSource.getRepository(User);
        const senders = await userRepo
          .createQueryBuilder('u')
          .select(['u.id', 'u.displayName'])
          .where('u.id IN (:...ids)', { ids: senderIds })
          .getMany();
        senderMap = new Map(senders.map(u => [u.id, u.displayName]));
        console.log(`[listMessages] fetched ${senders.length} sender names`);
      } catch (err) {
        console.warn('[listMessages] senderName lookup failed:', err);
      }
    }

    for (const r of repliedMsgs) {
      repliedMessagesMap.set(r.id, {
        messageId: r.id,
        senderId: r.senderId,
        senderName: senderMap.get(r.senderId) || 'Người dùng',
        body: r.content,
        attachments: Array.isArray(r.attachments) ? r.attachments : [],
        isDeleted: false,
      });
    }
  }

  const normalized = items
    .reverse()
    .map((msg) => ({
      ...msg,
      messageId: msg.id,
      body: msg.content,
      createdAt: toEpoch(msg.createdAt),
      isDeleted: false,
      replyToMessageId: msg.replyToId || null,
      replyTo: msg.replyToId ? (repliedMessagesMap.get(msg.replyToId) ?? null) : null,
    }));

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

  return {
    ...message,
    messageId: message.id,
    body: message.content,
    createdAt: toEpoch(message.createdAt),
    isDeleted: false,
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
        const attachments = Array.isArray(row.attachments) ? row.attachments : [];
        if (fileType === 'images') {
          return attachments.some((a: any) => String(a?.contentType || '').startsWith('image/'));
        }
        if (fileType === 'video') {
          return attachments.some((a: any) => String(a?.contentType || '').startsWith('video/'));
        }
        if (fileType === 'files') {
          return attachments.some((a: any) => !String(a?.contentType || '').startsWith('image/') && !String(a?.contentType || '').startsWith('video/'));
        }
        return true;
      })
    : rows;

  return filtered.map((msg) => ({
    ...msg,
    messageId: msg.id,
    body: msg.content,
    createdAt: toEpoch(msg.createdAt),
    isDeleted: false,
    replyToMessageId: msg.replyToId || null,
  }));
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

  return {
    ...msg,
    messageId: msg.id,
    body: msg.content,
    createdAt: toEpoch(msg.createdAt),
    editedAt: toEpoch(msg.editedAt),
  };
}

export async function lookupMessageById(messageId: string) {
  const message = await messageRepo().findOneBy({ id: messageId });
  if (!message) return null;
  return {
    ...message,
    messageId: message.id,
    body: message.content,
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
    createdAt: new Date(createdAt),
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
