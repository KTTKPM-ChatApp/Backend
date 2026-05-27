import { AppDataSource, ConversationSummary, User, ConversationMember, Message } from '../db';
import { In } from 'typeorm';
import { startConsumer } from '../rabbitmq';
import { notifyNewMessage, notifyMessageDeleted } from '../notifier';
import { cacheDeletePattern } from '../redis';
import { clearUserCache } from '../auth-client';
import { cacheMessage } from '../redis-messages';

const summaryRepo = () => AppDataSource.getRepository(ConversationSummary);
const userRepo = () => AppDataSource.getRepository(User);
const memberRepo = () => AppDataSource.getRepository(ConversationMember);
const messageRepo = () => AppDataSource.getRepository(Message);

function formatPreview(content: string, attachments?: any[]): string {
  if (content && content.trim()) return content.slice(0, 255);
  if (!attachments || attachments.length === 0) return '';
  const types = attachments.map((a: any) => a.type);
  if (types.includes('image')) return 'Đã gửi 1 ảnh';
  if (types.includes('video')) return 'Đã gửi 1 video';
  if (types.includes('audio')) return 'Đã gửi 1 tin nhắn thoại';
  return 'Đã gửi 1 tệp đính kèm';
}

export async function startEventConsumer(): Promise<void> {
  await startConsumer(async (routingKey, payload) => {
    switch (routingKey) {
      case 'chat.message.sent':
        await handleMessageSent(payload);
        break;
      case 'chat.message.deleted':
        await handleMessageDeleted(payload);
        break;
      case 'user.created':
        await handleUserCreated(payload);
        break;
      case 'user.updated':
        await handleUserUpdated(payload);
        break;
    }
  });
}

async function handleMessageSent(event: any): Promise<void> {
  const data = event.data || event;
  const {
    messageId,
    conversationId,
    senderId,
    senderName: eventSenderName,
    content,
    contentType,
    createdAt,
    attachments,
    allMemberIds: eventMemberIds,
    conversationType,
    conversationTitle,
    conversationAvatar,
    replyToId,
  } = data;

  // Resolve sender name and member IDs from DB if not provided
  let resolvedSenderName = eventSenderName || '';
  let resolvedMemberIds: string[] = eventMemberIds || [];

  try {
    if (!resolvedSenderName) {
      const sender = await userRepo().findOneBy({ id: senderId });
      resolvedSenderName = sender?.displayName || sender?.username || senderId;
    }
    if (!resolvedMemberIds.length) {
      const members = await memberRepo().find({ where: { conversationId } });
      resolvedMemberIds = members.map(m => m.userId);
    }
  } catch (err) {
    console.warn('[Consumer] failed to resolve sender/members:', err);
  }

  if (!resolvedSenderName) resolvedSenderName = 'Người dùng';

  const preview = formatPreview(content, attachments);
  const createdAtDate = new Date(createdAt);

  // 1. Update read model (conversation_summaries) with atomic unreadCount increment
  //    - Sender: update metadata only, don't increment unread
  //    - Others: update metadata + atomic unreadCount += 1
  await Promise.allSettled(
    resolvedMemberIds.map(async (memberId: string) => {
      const isSender = memberId === senderId;
      const repo = summaryRepo();
      const existing = await repo.findOneBy({ userId: memberId, conversationId });

      if (existing) {
        await repo
          .createQueryBuilder()
          .update(ConversationSummary)
          .set({
            lastMessageId: messageId,
            lastMessagePreview: preview,
            lastMessageAt: createdAtDate,
            lastSenderId: senderId,
            lastSenderName: resolvedSenderName,
            conversationType: conversationType || undefined,
            conversationTitle: conversationTitle || undefined,
            conversationAvatar: conversationAvatar || undefined,
            unreadCount: () => `unread_count ${isSender ? '+ 0' : '+ 1'}`,
          })
          .where('user_id = :userId AND conversation_id = :conversationId', {
            userId: memberId,
            conversationId,
          })
          .execute();
      } else {
        await repo.upsert({
          userId: memberId,
          conversationId,
          lastMessageId: messageId,
          lastMessagePreview: preview,
          lastMessageAt: createdAtDate,
          lastSenderId: senderId,
          lastSenderName: resolvedSenderName,
          conversationType: conversationType || undefined,
          conversationTitle: conversationTitle || undefined,
          conversationAvatar: conversationAvatar || undefined,
          unreadCount: isSender ? 0 : 1,
        }, ['userId', 'conversationId']);
      }
    })
  );

  // 2. Cache message in Redis read model (non-blocking)
  cacheMessage(conversationId, messageId, {
    messageId,
    senderId,
    senderName: resolvedSenderName,
    body: content,
    contentType: contentType || 'TEXT',
    attachments: attachments || [],
    createdAt: createdAtDate.getTime(),
    replyToMessageId: replyToId || null,
  }, createdAtDate.getTime());

  // 3. Invalidate Redis conversation list cache
  await Promise.allSettled(
    resolvedMemberIds.map((memberId: string) =>
      cacheDeletePattern(`convlist:${memberId}:*`)
    )
  );

  // 4. Realtime notification
  const receiverIds = resolvedMemberIds.filter(id => id !== senderId);
  await notifyNewMessage({
    messageId,
    senderId,
    senderName: resolvedSenderName,
    receiverIds,
    conversationId,
    content,
    contentType,
    createdAt,
    attachments: attachments || [],
    replyToId: replyToId || null,
  });

  console.log(`[Consumer] message.sent: ${messageId} -> ${resolvedMemberIds.length} members`);
}

async function handleMessageDeleted(event: any): Promise<void> {
  const data = event.data || event;
  const { messageId, conversationId, senderId, senderName, deletedAt, allMemberIds } = data;

  const preview = 'Đã thu hồi tin nhắn';

  let resolvedMemberIds: string[] = allMemberIds || [];

  try {
    if (!resolvedMemberIds.length) {
      const members = await memberRepo().find({ where: { conversationId } });
      resolvedMemberIds = members.map(m => m.userId);
    }
  } catch (err) {
    console.warn('[Consumer] failed to resolve members for delete:', err);
  }

  // 1. Update conversation_summaries preview for all members
  await Promise.allSettled(
    resolvedMemberIds.map(async (memberId: string) => {
      const repo = summaryRepo();
      const existing = await repo.findOneBy({ userId: memberId, conversationId });
      if (existing && existing.lastMessageId === messageId) {
        await repo
          .createQueryBuilder()
          .update(ConversationSummary)
          .set({ lastMessagePreview: preview })
          .where('user_id = :userId AND conversation_id = :conversationId', {
            userId: memberId,
            conversationId,
          })
          .execute();
      }
    })
  );

  // 2. Invalidate Redis conversation list cache
  await Promise.allSettled(
    resolvedMemberIds.map((memberId: string) =>
      cacheDeletePattern(`convlist:${memberId}:*`)
    )
  );

  // 3. Realtime notification via STOMP
  const receiverIds = resolvedMemberIds.filter(id => id !== senderId);
  await notifyMessageDeleted({
    messageId,
    conversationId,
    senderId,
    deletedAt: deletedAt || new Date().toISOString(),
  });

  console.log(`[Consumer] message.deleted: ${messageId} -> ${resolvedMemberIds.length} members`);
}

async function handleUserCreated(event: any): Promise<void> {
  const data = event.data || event;
  const { id, username, displayName, avatarUrl, email, isActive, bio, gender, phone } = data;
  if (!id) return;

  try {
    const existing = await userRepo().findOneBy({ id });
    if (existing) {
      // Already synced — skip
      return;
    }
    await userRepo().save(userRepo().create({
      id,
      username: username || id,
      displayName: displayName || username || id,
      email: email || '',
      avatarUrl: avatarUrl || null,
      isActive: isActive !== false,
      bio: bio || null,
      gender: gender || null,
      phone: phone || null,
    }));
    console.log(`[Consumer] user.created: ${id} (${displayName})`);
  } catch (error) {
    console.error(`[Consumer] user.created error for ${id}:`, error);
  }
}

async function handleUserUpdated(event: any): Promise<void> {
  const data = event.data || event;
  const { id, changes } = data;
  if (!id || !changes) return;

  try {
    const updateData: any = {};
    if (changes.username !== undefined) updateData.username = changes.username;
    if (changes.displayName !== undefined) updateData.displayName = changes.displayName;
    if (changes.avatarUrl !== undefined) updateData.avatarUrl = changes.avatarUrl;
    if (changes.email !== undefined) updateData.email = changes.email;
    if (changes.isActive !== undefined) updateData.isActive = changes.isActive;
    if (changes.bio !== undefined) updateData.bio = changes.bio;
    if (changes.gender !== undefined) updateData.gender = changes.gender;
    if (changes.phone !== undefined) updateData.phone = changes.phone;

    if (Object.keys(updateData).length > 0) {
      await userRepo().update(id, updateData);
      console.log(`[Consumer] user.updated: ${id} fields=${Object.keys(updateData).join(',')}`);
    }

    // Clear AuthClientService in-memory cache so fresh data is fetched
    clearUserCache(id);

    // Update lastSenderName in all conversation summaries where this user was the last sender
    if (changes.displayName !== undefined) {
      await summaryRepo().update(
        { lastSenderId: id },
        { lastSenderName: changes.displayName }
      );

      // Invalidate Redis conversation list cache for all conversations this user is in
      const memberships = await memberRepo().find({ where: { userId: id } });
      const conversationIds = [...new Set(memberships.map(m => m.conversationId))];
      await Promise.allSettled(
        conversationIds.map((convId: string) =>
          cacheDeletePattern(`convlist:*:${convId}:*`)
        )
      );
    }
  } catch (error) {
    console.error(`[Consumer] user.updated error for ${id}:`, error);
  }
}
