import {
  checkMembership,
  pollRepo,
  voteRepo,
} from '../shared/conversation-context';

export async function listPolls(
  userId: string,
  conversationId: string,
  status?: string,
  page: number = 1,
  limit: number = 20
) {
  await checkMembership(userId, conversationId);

  const offset = (page - 1) * limit;

  const qb = pollRepo()
    .createQueryBuilder('p')
    .where('p.conversation_id = :conversationId', { conversationId });

  if (status) {
    qb.andWhere('p.status = :status', { status });
  }

  const polls = await qb
    .orderBy('p.created_at', 'DESC')
    .limit(limit)
    .offset(offset)
    .getMany();

  const pollIds = polls.map(p => p.id);
  const votes = await voteRepo()
    .createQueryBuilder('v')
    .where('v.poll_id IN (:...ids)', { ids: pollIds })
    .getMany();

  const voteMap = new Map<string, any[]>();
  votes.forEach(vote => {
    if (!voteMap.has(vote.pollId)) voteMap.set(vote.pollId, []);
    voteMap.get(vote.pollId)!.push(vote);
  });

  return {
    data: polls.map(poll => ({
      ...poll,
      totalVotes: voteMap.get(poll.id)?.length || 0,
      userVote: voteMap.get(poll.id)?.find(v => v.userId === userId),
    })),
    meta: {
      total: polls.length,
      page,
      limit,
      totalPages: Math.ceil(polls.length / limit),
      hasNext: polls.length >= limit,
      hasPrev: page > 1,
    },
  };
}

export async function getPollDetails(
  userId: string,
  conversationId: string,
  pollId: string
) {
  await checkMembership(userId, conversationId);

  const poll = await pollRepo().findOneBy({ id: pollId, conversationId });
  if (!poll) {
    throw new Error('Poll not found');
  }

  const votes = await voteRepo().findBy({ pollId });
  const userVote = votes.find(v => v.userId === userId);

  return {
    ...poll,
    totalVotes: votes.length,
    userVote,
  };
}
