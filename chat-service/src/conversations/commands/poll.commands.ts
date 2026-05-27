import { v4 as uuid } from 'uuid';
import { PollOption } from '../../db';
import {
  checkMembership,
  memberRepo,
  pollRepo,
  voteRepo,
} from '../shared/conversation-context';

function calculateUpdatedOptions(poll: any, votes: Array<{ optionIds: string[] }>) {
  const voteCounts = new Map<string, number>();

  votes.forEach(vote => {
    vote.optionIds.forEach(optionId => {
      voteCounts.set(optionId, (voteCounts.get(optionId) || 0) + 1);
    });
  });

  return poll.options.map((option: PollOption) => ({
    ...option,
    votes: voteCounts.get(option.id) || 0,
  }));
}

export async function createPoll(
  userId: string,
  conversationId: string,
  pollData: any
) {
  await checkMembership(userId, conversationId);

  const { question, options, allow_multiple, allow_add_option, is_anonymous, expires_in_hours } = pollData;

  if (!question?.trim()) {
    throw new Error('Poll question is required');
  }

  if (!Array.isArray(options) || options.length < 2 || options.length > 20) {
    throw new Error('Poll must have between 2 and 20 options');
  }

  const pollOptions: PollOption[] = options.map((label: string) => ({
    id: uuid(),
    label: label.trim(),
    votes: 0,
    createdAt: new Date(),
  }));

  let expiresAt: Date | undefined;
  if (expires_in_hours) {
    expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expires_in_hours);
  }

  const poll = pollRepo().create({
    id: uuid(),
    conversationId,
    createdBy: userId,
    question: question.trim(),
    options: pollOptions,
    allowMultiple: allow_multiple || false,
    allowAddOption: allow_add_option || false,
    isAnonymous: is_anonymous || false,
    expiresAt,
  });

  await pollRepo().save(poll);

  return poll;
}

export async function updatePoll(
  userId: string,
  conversationId: string,
  pollId: string,
  updateData: any
) {
  const poll = await pollRepo().findOneBy({ id: pollId, conversationId });
  if (!poll) {
    throw new Error('Poll not found');
  }

  if (poll.createdBy !== userId) {
    throw new Error('Only the poll creator can edit it');
  }

  if (poll.status !== 'OPEN') {
    throw new Error('Cannot edit closed poll');
  }

  const { question, allow_multiple, allow_add_option, expires_at, edited_option_labels } = updateData;

  const updates: any = {};
  if (question !== undefined) updates.question = question.trim();
  if (allow_multiple !== undefined) updates.allowMultiple = allow_multiple;
  if (allow_add_option !== undefined) updates.allowAddOption = allow_add_option;
  if (expires_at !== undefined) updates.expiresAt = new Date(expires_at);

  if (edited_option_labels && Array.isArray(edited_option_labels)) {
    const updatedOptions = poll.options.map((option: PollOption) => {
      const edit = edited_option_labels.find((e: any) => e.id === option.id);
      if (edit) {
        return { ...option, label: edit.label.trim() };
      }
      return option;
    });
    updates.options = updatedOptions;
  }

  await pollRepo().update(pollId, updates);

  return pollRepo().findOneBy({ id: pollId });
}

export async function votePoll(
  userId: string,
  conversationId: string,
  pollId: string,
  optionIds: string[]
) {
  const poll = await pollRepo().findOneBy({ id: pollId, conversationId });
  if (!poll) {
    throw new Error('Poll not found');
  }

  if (poll.status !== 'OPEN') {
    throw new Error('Poll is closed');
  }

  if (poll.expiresAt && poll.expiresAt < new Date()) {
    throw new Error('Poll has expired');
  }

  const validOptionIds = poll.options.map((o: PollOption) => o.id);
  const invalidOptionIds = optionIds.filter(id => !validOptionIds.includes(id));

  if (invalidOptionIds.length > 0) {
    throw new Error('Invalid option IDs');
  }

  if (!poll.allowMultiple && optionIds.length > 1) {
    throw new Error('This poll does not allow multiple selections');
  }

  if (poll.allowMultiple && optionIds.length > 20) {
    throw new Error('Cannot select more than 20 options');
  }

  await voteRepo().delete({ pollId, userId });

  await voteRepo().save(voteRepo().create({
    id: uuid(),
    pollId,
    userId,
    optionIds,
  }));

  const votes = await voteRepo().findBy({ pollId });
  await pollRepo().update(pollId, { options: calculateUpdatedOptions(poll, votes) });

  return { message: 'Vote recorded successfully' };
}

export async function withdrawVote(
  userId: string,
  conversationId: string,
  pollId: string
) {
  const poll = await pollRepo().findOneBy({ id: pollId, conversationId });
  if (!poll) {
    throw new Error('Poll not found');
  }

  if (poll.status !== 'OPEN') {
    throw new Error('Cannot withdraw vote from closed poll');
  }

  await voteRepo().delete({ pollId, userId });

  const votes = await voteRepo().findBy({ pollId });
  await pollRepo().update(pollId, { options: calculateUpdatedOptions(poll, votes) });

  return { message: 'Vote withdrawn successfully' };
}

export async function addPollOption(
  userId: string,
  conversationId: string,
  pollId: string,
  label: string
) {
  const poll = await pollRepo().findOneBy({ id: pollId, conversationId });
  if (!poll) {
    throw new Error('Poll not found');
  }

  if (poll.createdBy !== userId) {
    throw new Error('Only the poll creator can add options');
  }

  if (!poll.allowAddOption) {
    throw new Error('This poll does not allow adding options');
  }

  if (poll.status !== 'OPEN') {
    throw new Error('Cannot add options to closed poll');
  }

  if (poll.options.length >= 20) {
    throw new Error('Poll cannot have more than 20 options');
  }

  const newOption: PollOption = {
    id: uuid(),
    label: label.trim(),
    votes: 0,
    createdAt: new Date(),
  };

  const updatedOptions = [...poll.options, newOption];
  await pollRepo().update(pollId, { options: updatedOptions });

  return { message: 'Option added successfully', option: newOption };
}

export async function removePollOption(
  userId: string,
  conversationId: string,
  pollId: string,
  optionId: string
) {
  const poll = await pollRepo().findOneBy({ id: pollId, conversationId });
  if (!poll) {
    throw new Error('Poll not found');
  }

  if (poll.createdBy !== userId) {
    throw new Error('Only the poll creator can remove options');
  }

  if (poll.status !== 'OPEN') {
    throw new Error('Cannot remove options from closed poll');
  }

  const option = poll.options.find((o: PollOption) => o.id === optionId);
  if (!option) {
    throw new Error('Option not found');
  }

  if (option.votes > 0) {
    throw new Error('Cannot remove option that has votes');
  }

  const updatedOptions = poll.options.filter((o: PollOption) => o.id !== optionId);
  await pollRepo().update(pollId, { options: updatedOptions });

  return { message: 'Option removed successfully' };
}

export async function closePoll(
  userId: string,
  conversationId: string,
  pollId: string
) {
  const poll = await pollRepo().findOneBy({ id: pollId, conversationId });
  if (!poll) {
    throw new Error('Poll not found');
  }

  const member = await memberRepo().findOneBy({ conversationId, userId });
  if (!member) {
    throw new Error('You are not a member of this conversation');
  }

  const canClose =
    poll.createdBy === userId ||
    member.role === 'OWNER' ||
    member.role === 'ADMIN';

  if (!canClose) {
    throw new Error('You do not have permission to close this poll');
  }

  if (poll.status !== 'OPEN') {
    throw new Error('Poll is already closed');
  }

  await pollRepo().update(pollId, {
    status: 'CLOSED',
    closedAt: new Date(),
    closedBy: userId,
  });

  return pollRepo().findOneBy({ id: pollId });
}
