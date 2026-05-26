import { AppDataSource, ConversationSummary, User } from '../db';
import { startConsumer } from '../rabbitmq';
import { notifyNewMessage } from '../notifier';
import { cacheDeletePattern } from '../redis';

const summaryRepo = () => AppDataSource.getRepository(ConversationSummary);
const userRepo = () => AppDataSource.getRepository(User);

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
    senderName,
    content,
    contentType,
    createdAt,
    attachments,
    allMemberIds,
    conversationType,
    conversationTitle,
    conversationAvatar,
  } = data;

  const preview = formatPreview(content, attachments);
  const createdAtDate = new Date(createdAt);

  // 1. Update read model (conversation_summaries) for ALL members
  const summaries = (allMemberIds as string[]).map((memberId: string) => ({
    userId: memberId,
    conversationId,
    lastMessageId: messageId,
    lastMessagePreview: preview,
    lastMessageAt: createdAtDate,
    lastSenderId: senderId,
    lastSenderName: senderName,
    conversationType: conversationType || undefined,
    conversationTitle: conversationTitle || undefined,
    conversationAvatar: conversationAvatar || undefined,
  }));

  await Promise.allSettled(
    summaries.map(s =>
      summaryRepo().upsert(s, ['userId', 'conversationId'])
    )
  );

  // 2. Invalidate Redis conversation list cache
  await Promise.allSettled(
    (allMemberIds as string[]).map((memberId: string) =>
      cacheDeletePattern(`convlist:${memberId}:*`)
    )
  );

  // 3. Realtime notification
  const receiverIds = (allMemberIds as string[]).filter(id => id !== senderId);
  await notifyNewMessage({
    messageId,
    senderId,
    senderName,
    receiverIds,
    conversationId,
    content,
    contentType,
    createdAt,
    attachments: attachments || [],
  });

  console.log(`[Consumer] message.sent: ${messageId} -> ${allMemberIds.length} members`);
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
  } catch (error) {
    console.error(`[Consumer] user.updated error for ${id}:`, error);
  }
}
