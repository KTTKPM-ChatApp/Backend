import { Conversation, ConversationMember } from '../../db';
import { inviteRepo } from '../shared/conversation-context';

export async function getPendingInvites(
  userId: string,
  page: number = 1,
  limit: number = 20,
  status?: string
) {
  const offset = (page - 1) * limit;

  const qb = inviteRepo()
    .createQueryBuilder('i')
    .leftJoin(Conversation, 'c', 'c.id = i.conversation_id')
    .leftJoin(ConversationMember, 'm', 'm.conversation_id = i.conversation_id AND m.user_id = :userId', { userId })
    .where('i.user_id = :userId', { userId });

  if (status) {
    qb.andWhere('i.status = :status', { status });
  }

  const invites = await qb
    .select(['i.*', 'c.title', 'c.type', 'c.avatar_url'])
    .orderBy('i.created_at', 'DESC')
    .limit(limit)
    .offset(offset)
    .getRawMany();

  return {
    data: invites,
    meta: {
      total: invites.length,
      page,
      limit,
      totalPages: Math.ceil(invites.length / limit),
      hasNext: invites.length >= limit,
      hasPrev: page > 1,
    },
  };
}
