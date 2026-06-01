import { AppDataSource } from '../db';
import { ChatbotConversation } from './chatbot-conversation.entity';
import { ChatbotMessage } from './chatbot-message.entity';
import { askAI } from './ai.service';

const convRepo = () => AppDataSource.getRepository(ChatbotConversation);
const msgRepo = () => AppDataSource.getRepository(ChatbotMessage);

export async function listConversations(userId: string) {
  return convRepo().find({
    where: { userId },
    order: { updatedAt: 'DESC' },
  });
}

export async function createConversation(userId: string, title?: string) {
  const conv = convRepo().create({
    userId,
    title: title || 'New Conversation',
  });
  return convRepo().save(conv);
}

export async function getConversation(userId: string, conversationId: string) {
  const conv = await convRepo().findOne({
    where: { id: conversationId, userId },
  });
  if (!conv) throw new Error('Conversation not found');
  return conv;
}

export async function deleteConversation(userId: string, conversationId: string) {
  const conv = await convRepo().findOne({
    where: { id: conversationId, userId },
  });
  if (!conv) throw new Error('Conversation not found');
  await convRepo().remove(conv);
  return { deleted: true };
}

export async function listMessages(userId: string, conversationId: string) {
  await getConversation(userId, conversationId);
  return msgRepo().find({
    where: { conversationId },
    order: { createdAt: 'ASC' },
  });
}

export async function sendMessage(userId: string, conversationId: string, content: string) {
  await getConversation(userId, conversationId);

  // 1. Save user message
  const userMsg = msgRepo().create({
    conversationId,
    role: 'user',
    content,
  });
  await msgRepo().save(userMsg);

  // 2. Fetch conversation history for context
  const history = await msgRepo().find({
    where: { conversationId },
    order: { createdAt: 'ASC' },
    take: 50,
  });

  // 3. Delegation of AI Response to the specialized gemini.service
  const aiResult = await askAI(history, userId);

  // 4. Save assistant message
  const assistantMsg = msgRepo().create({
    conversationId,
    role: 'assistant',
    content: aiResult.text,
    metadata: aiResult.metadata,
  });
  await msgRepo().save(assistantMsg);

  // 5. Update conversation title if it's the first exchange
  const msgCount = await msgRepo().count({ where: { conversationId } });
  if (msgCount <= 2) {
    const autoTitle = content.length > 50 ? content.substring(0, 50) + '...' : content;
    await convRepo().update(conversationId, { title: autoTitle });
  }

  return {
    userMessage: userMsg,
    assistantMessage: assistantMsg,
  };
}
