import { v4 as uuid } from 'uuid';
import {
  ensureMember,
  forwardRepo,
  messageRepo,
} from '../shared/message-context';

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
