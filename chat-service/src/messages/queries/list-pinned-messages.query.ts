import {
  ensureMember,
  messageRepo,
  pinRepo,
  toEpoch,
} from '../shared/message-context';

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
