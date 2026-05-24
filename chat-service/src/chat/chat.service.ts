import { v4 as uuid } from 'uuid';
import { AppDataSource, Conversation, ConversationMember, Message, User } from '../db';
import { notifyNewMessage } from '../notifier';
import { fetchUserInfo } from '../auth-client';
import { publishNewMessage } from '../rabbitmq';

const conversationRepo = () => AppDataSource.getRepository(Conversation);
const memberRepo = () => AppDataSource.getRepository(ConversationMember);
const messageRepo = () => AppDataSource.getRepository(Message);
const userRepo = () => AppDataSource.getRepository(User);

function buildDirectKey(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join(':');
}

export async function createConversation(
  currentUserId: string,
  type: 'DIRECT' | 'GROUP',
  participantIds: string[],
  title?: string
) {
  const uniqueParticipants = [...new Set(participantIds.filter(id => id !== currentUserId))];
  
  if (type === 'DIRECT') {
    if (uniqueParticipants.length !== 1) {
      throw new Error('Direct conversation requires exactly one other participant');
    }
    
    const otherUserId = uniqueParticipants[0];
    const directKey = buildDirectKey(currentUserId, otherUserId);
    const existing = await conversationRepo().findOneBy({ directKey });
    if (existing) {
      const members = await memberRepo().findBy({ conversationId: existing.id });
      return { ...existing, memberIds: members.map(m => m.userId) };
    }
    
    const userInfo = await fetchUserInfo(otherUserId);
    const convTitle = userInfo?.displayName ?? otherUserId;

    const conversation = conversationRepo().create({
      id: uuid(),
      type,
      title: convTitle,
      createdBy: currentUserId,
      directKey,
    });
    await conversationRepo().save(conversation);
    
    const memberIds = [currentUserId, otherUserId];
    await memberRepo().save(memberIds.map(userId => 
      memberRepo().create({ conversationId: conversation.id, userId, joinedAt: new Date() })
    ));
    
    return { ...conversation, memberIds };
  }
  
  // GROUP
  if (!title?.trim()) {
    throw new Error('Group conversation requires a title');
  }
  if (uniqueParticipants.length < 2) {
    throw new Error('Group conversation requires at least 2 other participants');
  }
  
  const conversation = conversationRepo().create({
    id: uuid(),
    type,
    title: title.trim(),
    createdBy: currentUserId,
  });
  await conversationRepo().save(conversation);
  
  const memberIds = [currentUserId, ...uniqueParticipants];
  await memberRepo().save(memberIds.map(userId => 
    memberRepo().create({ conversationId: conversation.id, userId, joinedAt: new Date() })
  ));
  
  return { ...conversation, memberIds };
}

export async function listConversations(userId: string, limit = 20, offset = 0) {
  const conversations = await conversationRepo()
    .createQueryBuilder('c')
    .innerJoin(ConversationMember, 'm', 'm.conversation_id = c.id AND m.user_id = :userId', { userId })
    .orderBy('COALESCE(c.last_message_at, c.updated_at)', 'DESC')
    .addOrderBy('c.id', 'DESC')
    .limit(limit)
    .offset(offset)
    .getMany();
  
  const conversationIds = conversations.map(c => c.id);
  if (conversationIds.length === 0) return [];
  
  const members = await memberRepo()
    .createQueryBuilder('m')
    .where('m.conversation_id IN (:...ids)', { ids: conversationIds })
    .getMany();
  
  const memberMap = new Map<string, string[]>();
  members.forEach(m => {
    if (!memberMap.has(m.conversationId)) memberMap.set(m.conversationId, []);
    memberMap.get(m.conversationId)!.push(m.userId);
  });
  
  // Fetch last messages for conversations that have them
  const lastMessageIds = conversations.map(c => c.lastMessageId).filter(Boolean) as string[];
  const lastMessagesMap = new Map<string, any>();
  
  if (lastMessageIds.length > 0) {
    const lastMessages = await messageRepo()
      .createQueryBuilder('msg')
      .where('msg.id IN (:...ids)', { ids: lastMessageIds })
      .getMany();
    
    // Get unique sender IDs from messages
    const senderIds = [...new Set(lastMessages.map(msg => msg.senderId))];
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
    
    lastMessages.forEach(msg => {
      const messageWithSender = {
        ...msg,
        sender: usersMap.get(msg.senderId) || null,
      };
      lastMessagesMap.set(msg.id, messageWithSender);
    });
  }
  
  return conversations.map(c => {
    const lastMessage = c.lastMessageId ? lastMessagesMap.get(c.lastMessageId) : null;
    return {
      ...c,
      memberIds: memberMap.get(c.id) || [],
      lastMessage: lastMessage ? {
        id: lastMessage.id,
        content: lastMessage.content,
        contentType: lastMessage.contentType,
        createdAt: lastMessage.createdAt.getTime(),
        senderId: lastMessage.senderId,
        sender: lastMessage.sender ? {
          id: lastMessage.sender.id,
          displayName: lastMessage.sender.displayName,
          username: lastMessage.sender.username,
          avatarUrl: lastMessage.sender.avatarUrl,
        } : null,
      } : null,
    };
  });
}

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
  
  // Update last message
  await conversationRepo().update(conversationId, {
    lastMessageId: message.id,
    lastMessagePreview: trimmedContent.slice(0, 255),
    lastMessageAt: message.createdAt,
    updatedAt: message.createdAt,
  });
  
  // Get all participants
  const members = await memberRepo().findBy({ conversationId });
  const participantIds = members.map(m => m.userId);
  
  // Gửi notification real-time tới tất cả participants (trừ sender)
  const receiverIds = participantIds.filter(id => id !== userId);
  
  let senderName = 'Người dùng';
  try {
    const sender = await userRepo().findOneBy({ id: userId });
    if (sender) senderName = sender.displayName;
  } catch (err) {
    console.warn('[sendMessage] senderName lookup failed:', err);
  }
  
  await notifyNewMessage({
    messageId: message.id,
    senderId: userId,
    senderName,
    receiverIds,
    conversationId: conversation.id,
    content: message.content,
    contentType: message.contentType,
    createdAt: message.createdAt.toISOString(),
    attachments: normalizedAttachments,
  });
  
  // Publish to RabbitMQ for event-driven architecture
  await publishNewMessage({
    messageId: message.id,
    senderId: userId,
    conversationId: conversation.id,
    content: message.content,
    contentType: message.contentType,
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
