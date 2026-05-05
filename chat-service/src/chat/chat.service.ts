import { v4 as uuid } from 'uuid';
import { AppDataSource, Conversation, ConversationMember, Message } from '../db';
import { notifyNewMessage } from '../notifier';

const conversationRepo = () => AppDataSource.getRepository(Conversation);
const memberRepo = () => AppDataSource.getRepository(ConversationMember);
const messageRepo = () => AppDataSource.getRepository(Message);

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
    
    const directKey = buildDirectKey(currentUserId, uniqueParticipants[0]);
    const existing = await conversationRepo().findOneBy({ directKey });
    if (existing) {
      const members = await memberRepo().findBy({ conversationId: existing.id });
      return { ...existing, memberIds: members.map(m => m.userId) };
    }
    
    const conversation = conversationRepo().create({
      id: uuid(),
      type,
      createdBy: currentUserId,
      directKey,
    });
    await conversationRepo().save(conversation);
    
    const memberIds = [currentUserId, uniqueParticipants[0]];
    await memberRepo().save(memberIds.map(userId => 
      memberRepo().create({ conversationId: conversation.id, userId })
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
    memberRepo().create({ conversationId: conversation.id, userId })
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
    
    lastMessages.forEach(msg => {
      lastMessagesMap.set(msg.id, msg);
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
        senderName: null, // Will be populated by frontend or join with users table
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
  return messages.reverse();
}

export async function sendMessage(
  userId: string,
  conversationId: string,
  content: string,
  contentType = 'TEXT',
  attachments: any[] = []
) {
  const conversation = await conversationRepo().findOneBy({ id: conversationId });
  if (!conversation) throw new Error('Conversation not found');
  
  const isMember = await memberRepo().findOneBy({ conversationId, userId });
  if (!isMember) throw new Error('You are not a member of this conversation');
  
  const trimmedContent = content.trim();
  if (!trimmedContent) throw new Error('Message content cannot be empty');
  
  const message = messageRepo().create({
    id: uuid(),
    conversationId,
    senderId: userId,
    contentType,
    content: trimmedContent,
  });
  await messageRepo().save(message);
  
  // Handle attachments if provided
  if (attachments && attachments.length > 0) {
    // TODO: Implement attachment storage
    // For now, just log attachments - you'll need to implement file storage
  }
  
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
  await notifyNewMessage({
    messageId: message.id,
    senderId: userId,
    receiverIds,
    conversationId: conversation.id,
    content: message.content,
    contentType: message.contentType,
    createdAt: message.createdAt.toISOString(),
  });
  
  return message;
}

// Media Upload Service
export async function uploadMedia(userId: string, file: any) {
  try {
    // TODO: Implement file storage (S3, local, etc.)
    const key = `media/${uuid()}-${file.originalname}`;
    const url = `http://localhost:3003/uploads/${key}`; // Temporary URL
    
    // Save file info to database (optional)
    // await mediaRepo().save({
    //   id: uuid(),
    //   userId,
    //   key,
    //   originalName: file.originalname,
    //   mimeType: file.mimetype,
    //   size: file.size,
    //   url,
    // });
    
    return {
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
