import { v4 as uuid } from 'uuid';
import { AppDataSource, Conversation, ConversationMember, Message, ConversationSummary, User } from '../db';
import { publishNewMessage } from '../rabbitmq';

const conversationRepo = () => AppDataSource.getRepository(Conversation);
const memberRepo = () => AppDataSource.getRepository(ConversationMember);
const messageRepo = () => AppDataSource.getRepository(Message);
const summaryRepo = () => AppDataSource.getRepository(ConversationSummary);
const userRepo = () => AppDataSource.getRepository(User);

export async function getConversationMessages(
  userId: string,
  conversationId: string,
  limit = 50,
  before?: string
) {
  const conversation = await conversationRepo().findOneBy({ id: conversationId });
  if (!conversation) throw new Error('Conversation not found');
  
  const isMember = await memberRepo().findOneBy({ conversationId, userId });
  if (!isMember) throw new Error('You are not a member of this conversation');
  
  const qb = messageRepo()
    .createQueryBuilder('m')
    .where('m.conversation_id = :conversationId', { conversationId })
    .orderBy('m.created_at', 'DESC')
    .addOrderBy('m.id', 'DESC')
    .limit(limit);
  
  if (before) {
    qb.andWhere('m.created_at < :before', { before: new Date(before) });
  }
  
  const messages = await qb.getMany();
  
  // Get unique sender IDs from messages
  const senderIds = [...new Set(messages.map(msg => msg.senderId))];
  const usersMap = new Map<string, any>();
  
  if (senderIds.length > 0) {
    const users = await userRepo()
      .createQueryBuilder('u')
      .where('u.id IN (:...ids)', { ids: senderIds })
      .getMany();
    
    users.forEach(user => {
      usersMap.set(user.id, {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        avatarUrl: user.avatarUrl,
      });
    });
  }
  
  // Parse attachments from JSON column on each message
  messages.forEach(msg => {
    const rawAtts = msg.attachments;
    if (Array.isArray(rawAtts)) {
      (msg as any).attachments = rawAtts;
    } else if (typeof rawAtts === 'string') {
      try { (msg as any).attachments = JSON.parse(rawAtts); } catch { (msg as any).attachments = []; }
    } else {
      (msg as any).attachments = [];
    }
    (msg as any).sender = usersMap.get(msg.senderId) || null;
  });
  
  return messages.reverse();
}

export async function sendMessage(
  userId: string,
  conversationId: string,
  content: string,
  contentType = 'TEXT',
  attachments: any[] = [],
  replyToId?: string | null
) {
  const conversation = await conversationRepo().findOneBy({ id: conversationId });
  if (!conversation) throw new Error('Conversation not found');
  
  const isMember = await memberRepo().findOneBy({ conversationId, userId });
  if (!isMember) throw new Error('You are not a member of this conversation');
  
  const trimmedContent = content.trim();
  if (!trimmedContent && (!attachments || attachments.length === 0)) {
    throw new Error('Message must contain content or at least one attachment');
  }
  
  const normalizedAttachments = (attachments || []).map((att) => {
    const contentType = att.contentType || att.content_type || '';
    const inferredType = att.type || 
      (contentType.startsWith('image/') ? 'image' : 
       contentType.startsWith('video/') ? 'video' : 
       contentType.startsWith('audio/') ? 'audio' : 'document');
    
    return {
      key: att.key || att.publicId || '',
      url: att.url || '',
      type: inferredType,
      name: att.name || att.fileName || att.originalName || 'file',
      size: att.size || 0,
      contentType,
      thumbnailUrl: att.thumbnailUrl || att.thumbnail_key || null,
      publicId: att.publicId || att.key || null,
      resourceType: att.resourceType || null,
    };
  });

  const hasMedia = normalizedAttachments.some(a => a.type === 'image' || a.type === 'video');
  const hasFiles = normalizedAttachments.some(a => a.type === 'document' || a.type === 'file' || a.type === 'audio');
  let detectedContentType = 'TEXT';
  if (!trimmedContent && normalizedAttachments.length > 0) {
    if (hasMedia && hasFiles) detectedContentType = 'MIXED';
    else if (hasMedia) detectedContentType = 'MEDIA';
    else if (hasFiles) detectedContentType = 'FILE';
    else detectedContentType = 'MEDIA';
  } else if (trimmedContent && normalizedAttachments.length > 0) {
    detectedContentType = 'MIXED';
  } else {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (urlRegex.test(trimmedContent)) detectedContentType = 'LINK';
  }
  
  const message = messageRepo().create({
    id: uuid(),
    conversationId,
    senderId: userId,
    contentType: detectedContentType,
    content: trimmedContent,
    replyToId: replyToId || undefined,
    attachments: normalizedAttachments.length > 0 ? normalizedAttachments : undefined,
  });
  await messageRepo().save(message);
  console.log(`[sendMessage] saved message ${message.id}, contentType=${detectedContentType}, attachments=${normalizedAttachments.length}`);

  // Get members + sender name for event payload (command context)
  const members = await memberRepo().findBy({ conversationId });
  const participantIds = members.map(m => m.userId);
  const receiverIds = participantIds.filter(id => id !== userId);

  let senderName = 'Người dùng';
  try {
    const sender = await userRepo().findOneBy({ id: userId });
    if (sender) senderName = sender.displayName;
  } catch (err) {
    console.warn('[sendMessage] senderName lookup failed:', err);
  }

  // Eagerly update conversation_summary for all members (visible immediately)
  const preview = trimmedContent.slice(0, 255);
  await Promise.allSettled(
    participantIds.map(memberId =>
      summaryRepo().upsert({
        userId: memberId,
        conversationId: conversation.id,
        lastMessageId: message.id,
        lastMessagePreview: preview,
        lastMessageAt: message.createdAt,
        lastSenderId: userId,
        lastSenderName: senderName,
        conversationType: conversation.type,
        conversationTitle: conversation.title,
        conversationAvatar: conversation.avatarUrl,
      }, ['userId', 'conversationId'])
    )
  );

  // Publish event → consumer builds read model + invalidates cache + notifies async
  await publishNewMessage({
    messageId: message.id,
    conversationId: conversation.id,
    senderId: userId,
    senderName,
    content: message.content,
    contentType: message.contentType,
    createdAt: message.createdAt.toISOString(),
    attachments: normalizedAttachments,
    receiverIds,
    allMemberIds: participantIds,
    conversationType: conversation.type,
    conversationTitle: conversation.title,
    conversationAvatar: conversation.avatarUrl,
  });

  return message;
}

// Media Upload Service
export async function uploadMedia(userId: string, file: any) {
  try {
    // Generate unique key and URL
    const key = `media/${uuid()}-${file.originalname}`;
    const url = `http://localhost:3003/uploads/${key}`; // For now, use local storage
    
    // In a production environment, you would:
    // 1. Upload file to S3, CloudFront, or other storage service
    // 2. Store the file info in database for tracking
    // 3. Return the proper CDN URL
    
    return {
      id: uuid(),
      key,
      url,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  } catch (error: any) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}
