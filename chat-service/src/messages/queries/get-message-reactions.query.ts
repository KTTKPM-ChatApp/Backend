import {
  ensureMember,
  messageRepo,
  reactionRepo,
} from '../shared/message-context';

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
