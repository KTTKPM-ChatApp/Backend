import {
  callRepo,
  checkMembership,
} from '../shared/conversation-context';

export async function getIceServers() {
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };
}

export async function getCallHistory(
  userId: string,
  conversationId: string,
  page: number = 1,
  limit: number = 20
) {
  await checkMembership(userId, conversationId);

  const offset = (page - 1) * limit;

  const calls = await callRepo()
    .createQueryBuilder('c')
    .where('c.conversation_id = :conversationId', { conversationId })
    .orderBy('c.started_at', 'DESC')
    .limit(limit)
    .offset(offset)
    .getMany();

  return {
    data: calls,
    meta: {
      total: calls.length,
      page,
      limit,
      totalPages: Math.ceil(calls.length / limit),
      hasNext: calls.length >= limit,
      hasPrev: page > 1,
    },
  };
}

export async function getCallState(
  userId: string,
  conversationId: string
) {
  await checkMembership(userId, conversationId);

  const activeCall = await callRepo()
    .createQueryBuilder('c')
    .where('c.conversation_id = :conversationId', { conversationId })
    .andWhere('c.status = :status', { status: 'ONGOING' })
    .getOne();

  if (!activeCall) {
    throw new Error('No active call found');
  }

  return activeCall;
}
