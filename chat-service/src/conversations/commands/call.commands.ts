import {
  callRepo,
  checkMembership,
} from '../shared/conversation-context';

export async function endCall(
  userId: string,
  conversationId: string,
  callId: string,
  reason?: string
) {
  const call = await callRepo().findOneBy({ id: callId, conversationId });
  if (!call) {
    throw new Error('Call not found');
  }

  if (call.status !== 'ONGOING') {
    throw new Error('Call is not ongoing');
  }

  const member = await checkMembership(userId, conversationId);
  const canEnd =
    call.startedBy === userId ||
    member.role === 'OWNER' ||
    member.role === 'ADMIN';

  if (!canEnd) {
    throw new Error('You do not have permission to end this call');
  }

  const endedAt = new Date();
  await callRepo().update(callId, {
    status: 'ENDED',
    endedAt,
    endedBy: userId,
    endReason: reason,
  });

  return callRepo().findOneBy({ id: callId });
}
