import { v4 as uuid } from 'uuid';
import { AppDataSource, Conversation, ConversationMember, Message } from '../db';
import { publishNewMessage } from '../rabbitmq';

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
  
  return conversations.map(c => ({
    ...c,
    memberIds: memberMap.get(c.id) || [],
  }));
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
  contentType = 'TEXT'
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
  
  // Publish NEW_MESSAGE event
  await publishNewMessage({
    eventId: uuid(),
    eventType: 'NEW_MESSAGE',
    occurredAt: message.createdAt.toISOString(),
    conversationId: conversation.id,
    conversationType: conversation.type,
    messageId: message.id,
    senderId: message.senderId,
    participantIds,
    contentType: message.contentType,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  });
  
  return message;
}
