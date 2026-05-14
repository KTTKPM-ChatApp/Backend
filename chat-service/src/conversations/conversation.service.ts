import { v4 as uuid } from 'uuid';
import { 
  AppDataSource, 
  Conversation, 
  ConversationMember, 
  Message,
  ConversationInvite,
  ConversationPoll,
  PollVote,
  ConversationCall,
  ConversationSettings,
  UserPinnedConversation,
  PollOption,
  CallParticipant,
  ConversationPermissions,
  ConversationPolicies,
  ConversationFeatures
} from '../db';

// Repository getters
const conversationRepo = () => AppDataSource.getRepository(Conversation);
const memberRepo = () => AppDataSource.getRepository(ConversationMember);
const messageRepo = () => AppDataSource.getRepository(Message);
const inviteRepo = () => AppDataSource.getRepository(ConversationInvite);
const pollRepo = () => AppDataSource.getRepository(ConversationPoll);
const voteRepo = () => AppDataSource.getRepository(PollVote);
const callRepo = () => AppDataSource.getRepository(ConversationCall);
const settingsRepo = () => AppDataSource.getRepository(ConversationSettings);
const pinnedRepo = () => AppDataSource.getRepository(UserPinnedConversation);

// Helper functions
function buildDirectKey(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join(':');
}

async function checkMembership(userId: string, conversationId: string): Promise<ConversationMember> {
  const member = await memberRepo().findOneBy({ conversationId, userId });
  if (!member) {
    throw new Error('You are not a member of this conversation');
  }
  return member;
}

async function checkAdminPermission(userId: string, conversationId: string): Promise<ConversationMember> {
  const member = await checkMembership(userId, conversationId);
  if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
    throw new Error('Only admin or owner can perform this action');
  }
  return member;
}

async function checkOwnerPermission(userId: string, conversationId: string): Promise<ConversationMember> {
  const member = await checkMembership(userId, conversationId);
  if (member.role !== 'OWNER') {
    throw new Error('Only owner can perform this action');
  }
  return member;
}

// 1. Quản lý Conversation cơ bản

export async function listConversations(userId: string, page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;
  
  const conversations = await conversationRepo()
    .createQueryBuilder('c')
    .innerJoin(ConversationMember, 'm', 'm.conversation_id = c.id AND m.user_id = :userId', { userId })
    .leftJoin(UserPinnedConversation, 'p', 'p.conversation_id = c.id AND p.user_id = :userId', { userId })
    .orderBy('p.pinned_at', 'DESC')
    .addOrderBy('COALESCE(c.last_message_at, c.updated_at)', 'DESC')
    .addOrderBy('c.id', 'DESC')
    .limit(limit)
    .offset(offset)
    .getMany();
  
  const conversationIds = conversations.map(c => c.id);
  if (conversationIds.length === 0) {
    return {
      data: [],
      meta: {
        total: 0,
        page,
        limit,
        totalPages: 0,
        hasNext: false,
        hasPrev: page > 1
      }
    };
  }
  
  const members = await memberRepo()
    .createQueryBuilder('m')
    .where('m.conversation_id IN (:...ids)', { ids: conversationIds })
    .getMany();
  
  const memberMap = new Map<string, any[]>();
  console.log('[DEBUG] Raw members from DB:', members.length, 'items');
  console.log('[DEBUG] First member raw data:', JSON.stringify(members[0], null, 2));
  members.forEach(m => {
    if (!memberMap.has(m.conversationId)) memberMap.set(m.conversationId, []);
    const displayName = m.nickname; // Use nickname from ConversationMember entity
    const memberData = {
      userId: m.userId,
      displayName: displayName,
      role: m.role
    };
    console.log(`[DEBUG] Adding to memberMap for ${m.conversationId}:`, JSON.stringify(memberData, null, 2));
    memberMap.get(m.conversationId)!.push(memberData);
  });
  console.log('[DEBUG] memberMap keys:', Array.from(memberMap.keys()));
  console.log('[DEBUG] memberMap size for conv-5:', memberMap.get('conv-5')?.length);
  
  const pinned = await pinnedRepo()
    .createQueryBuilder('p')
    .where('p.conversation_id IN (:...ids) AND p.user_id = :userId', { ids: conversationIds, userId })
    .getMany();
  
  const pinnedSet = new Set(pinned.map(p => p.conversationId));
  
  return {
    data: conversations.map(c => ({
      ...c,
      members: memberMap.get(c.id) || [],
      isPinned: pinnedSet.has(c.id)
    })),
    meta: {
      total: conversations.length,
      page,
      limit,
      totalPages: Math.ceil(conversations.length / limit),
      hasNext: conversations.length >= limit,
      hasPrev: page > 1
    }
  };
}

export async function getConversationById(userId: string, conversationId: string) {
  await checkMembership(userId, conversationId);
  
  const conversation = await conversationRepo().findOneBy({ id: conversationId });
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  const members = await memberRepo().findBy({ conversationId });
  
  return {
    ...conversation,
    members
  };
}

export async function createGroupConversation(
  createdBy: string,
  name: string,
  memberIds: string[],
  avatarUrl?: string
) {
  const uniqueMembers = [...new Set(memberIds.filter(id => id !== createdBy))];
  
  if (!name?.trim()) {
    throw new Error('Group conversation requires a name');
  }
  if (uniqueMembers.length < 2) {
    throw new Error('Group conversation requires at least 2 other participants');
  }
  if (uniqueMembers.length > 100) {
    throw new Error('Group conversation cannot have more than 100 members');
  }
  
  const conversation = conversationRepo().create({
    id: uuid(),
    type: 'GROUP',
    title: name.trim(),
    createdBy,
    avatarUrl
  });
  await conversationRepo().save(conversation);
  
  const allMemberIds = [createdBy, ...uniqueMembers];
  await memberRepo().save(allMemberIds.map(userId => 
    memberRepo().create({ 
      conversationId: conversation.id, 
      userId,
      role: userId === createdBy ? 'OWNER' : 'MEMBER'
    })
  ));
  
  // Initialize default settings
  await settingsRepo().save(settingsRepo().create({
    conversationId: conversation.id,
    permissions: {
      canAddMembers: true,
      canRemoveMembers: true,
      canCreatePolls: true,
      canStartCall: true,
      canSendMessage: true
    },
    policies: {
      maxMembers: 100,
      inviteApproval: false,
      messageRetention: 30
    },
    features: {
      polls: true,
      calls: true,
      fileSharing: true,
      reactions: true
    }
  }));
  
  const members = await memberRepo().findBy({ conversationId: conversation.id });
  
  return {
    ...conversation,
    members
  };
}

export async function createDirectConversation(
  createdBy: string,
  participantId: string
) {
  if (participantId === createdBy) {
    throw new Error('Cannot create conversation with yourself');
  }
  
  const directKey = buildDirectKey(createdBy, participantId);
  const existing = await conversationRepo().findOneBy({ directKey });
  
  if (existing) {
    const members = await memberRepo().findBy({ conversationId: existing.id });
    return {
      ...existing,
      members
    };
  }
  
  const conversation = conversationRepo().create({
    id: uuid(),
    type: 'DIRECT',
    createdBy,
    directKey
  });
  await conversationRepo().save(conversation);
  
  const memberIds = [createdBy, participantId];
  await memberRepo().save(memberIds.map(userId => 
    memberRepo().create({ 
      conversationId: conversation.id, 
      userId,
      joinedAt: new Date()
    })
  ));
  
  const members = await memberRepo().findBy({ conversationId: conversation.id });
  
  return {
    ...conversation,
    members
  };
}

export async function updateConversation(
  userId: string,
  conversationId: string,
  name?: string,
  avatarUrl?: string
) {
  await checkAdminPermission(userId, conversationId);
  
  const updateData: any = {};
  if (name !== undefined) updateData.title = name.trim();
  if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
  
  await conversationRepo().update(conversationId, updateData);
  
  const conversation = await conversationRepo().findOneBy({ id: conversationId });
  const members = await memberRepo().findBy({ conversationId });
  
  return {
    ...conversation,
    members
  };
}

// 2. Quản lý Thành viên

export async function addMembers(
  userId: string,
  conversationId: string,
  memberIds: string[]
) {
  await checkAdminPermission(userId, conversationId);
  
  const conversation = await conversationRepo().findOneBy({ id: conversationId });
  if (conversation?.type === 'DIRECT') {
    throw new Error('Cannot add members to direct conversation');
  }
  
  const settings = await settingsRepo().findOneBy({ conversationId });
  const maxMembers = settings?.policies?.maxMembers || 100;
  
  const existingMembers = await memberRepo().findBy({ conversationId });
  if (existingMembers.length + memberIds.length > maxMembers) {
    throw new Error(`Cannot exceed maximum of ${maxMembers} members`);
  }
  
  const uniqueMembers = [...new Set(memberIds)];
  const existingMemberIds = new Set(existingMembers.map(m => m.userId));
  const newMemberIds = uniqueMembers.filter(id => !existingMemberIds.has(id));
  
  if (newMemberIds.length === 0) {
    throw new Error('All users are already members');
  }
  
  await memberRepo().save(newMemberIds.map(userId => 
    memberRepo().create({ conversationId, userId, role: 'MEMBER' })
  ));
  
  return { message: `Added ${newMemberIds.length} members successfully` };
}

export async function removeMember(
  userId: string,
  conversationId: string,
  memberId: string
) {
  const member = await memberRepo().findOneBy({ conversationId, userId });
  const targetMember = await memberRepo().findOneBy({ conversationId, userId: memberId });
  
  if (!member || !targetMember) {
    throw new Error('Member not found');
  }
  
  // User can remove themselves, or admin/owner can remove others
  const canRemove = userId === memberId || 
                   member.role === 'OWNER' || 
                   (member.role === 'ADMIN' && targetMember.role !== 'OWNER');
  
  if (!canRemove) {
    throw new Error('You cannot remove this member');
  }
  
  // Check if this is the last member
  const allMembers = await memberRepo().findBy({ conversationId });
  if (allMembers.length === 1) {
    throw new Error('Cannot remove the last member. Use disband instead.');
  }
  
  await memberRepo().delete({ conversationId, userId: memberId });
  
  return { message: 'Member removed successfully' };
}

export async function leaveConversation(
  userId: string,
  conversationId: string
) {
  const member = await checkMembership(userId, conversationId);
  
  if (member.role === 'OWNER') {
    const allMembers = await memberRepo().findBy({ conversationId });
    if (allMembers.length > 1) {
      throw new Error('Owner cannot leave group with other members. Transfer ownership first.');
    }
  }
  
  await memberRepo().delete({ conversationId, userId });
  
  return { message: 'Left conversation successfully' };
}

export async function updateMemberRole(
  userId: string,
  conversationId: string,
  memberId: string,
  newRole: 'ADMIN' | 'MEMBER'
) {
  await checkOwnerPermission(userId, conversationId);
  
  if (userId === memberId) {
    throw new Error('Cannot change your own role');
  }
  
  const targetMember = await memberRepo().findOneBy({ conversationId, userId: memberId });
  if (!targetMember) {
    throw new Error('Member not found');
  }
  
  if (targetMember.role === 'OWNER') {
    throw new Error('Cannot change owner role');
  }
  
  await memberRepo().update({ conversationId, userId: memberId }, { role: newRole });
  
  const updatedMember = await memberRepo().findOneBy({ conversationId, userId: memberId });
  
  return updatedMember;
}

export async function updateUserSettings(
  userId: string,
  conversationId: string,
  nickname?: string,
  isMuted?: boolean
) {
  const member = await checkMembership(userId, conversationId);
  
  const updateData: any = {};
  if (nickname !== undefined) updateData.nickname = nickname?.trim();
  if (isMuted !== undefined) updateData.isMuted = isMuted;
  
  await memberRepo().update({ conversationId, userId }, updateData);
  
  const updatedMember = await memberRepo().findOneBy({ conversationId, userId });
  
  return updatedMember;
}

// 3. Quản lý Lời mời nhóm

export async function sendInvites(
  userId: string,
  conversationId: string,
  userIds: string[],
  message?: string,
  expiresInHours: number = 24
) {
  await checkAdminPermission(userId, conversationId);
  
  const conversation = await conversationRepo().findOneBy({ id: conversationId });
  if (conversation?.type === 'DIRECT') {
    throw new Error('Cannot invite to direct conversation');
  }
  
  const existingMembers = await memberRepo().findBy({ conversationId });
  const existingMemberIds = new Set(existingMembers.map(m => m.userId));
  
  const uniqueUserIds = [...new Set(userIds)];
  const validUserIds = uniqueUserIds.filter(id => !existingMemberIds.has(id));
  
  if (validUserIds.length === 0) {
    throw new Error('All users are already members');
  }
  
  if (validUserIds.length > 50) {
    throw new Error('Cannot invite more than 50 users at once');
  }
  
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);
  
  const invites = validUserIds.map(targetUserId => 
    inviteRepo().create({
      id: uuid(),
      conversationId,
      invitedBy: userId,
      userId: targetUserId,
      message,
      expiresAt
    })
  );
  
  await inviteRepo().save(invites);
  
  return {
    message: `Sent ${invites.length} invites successfully`,
    invites: invites.map(inv => ({ id: inv.id, userId: inv.userId }))
  };
}

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
      hasPrev: page > 1
    }
  };
}

export async function acceptInvite(
  userId: string,
  conversationId: string,
  inviteId: string
) {
  const invite = await inviteRepo().findOneBy({ id: inviteId, conversationId, userId });
  
  if (!invite) {
    throw new Error('Invite not found');
  }
  
  if (invite.status !== 'PENDING') {
    throw new Error('Invite is no longer pending');
  }
  
  if (invite.expiresAt < new Date()) {
    throw new Error('Invite has expired');
  }
  
  // Check if user is already a member
  const existingMember = await memberRepo().findOneBy({ conversationId, userId });
  if (existingMember) {
    throw new Error('You are already a member of this conversation');
  }
  
  // Add user as member
  await memberRepo().save(memberRepo().create({
    conversationId,
    userId,
    role: 'MEMBER'
  }));
  
  // Update invite status
  await inviteRepo().update(inviteId, { 
    status: 'ACCEPTED', 
    respondedAt: new Date() 
  });
  
  return { message: 'Invite accepted successfully' };
}

export async function rejectInvite(
  userId: string,
  conversationId: string,
  inviteId: string
) {
  const invite = await inviteRepo().findOneBy({ id: inviteId, conversationId, userId });
  
  if (!invite) {
    throw new Error('Invite not found');
  }
  
  if (invite.status !== 'PENDING') {
    throw new Error('Invite is no longer pending');
  }
  
  await inviteRepo().update(inviteId, { 
    status: 'REJECTED', 
    respondedAt: new Date() 
  });
  
  return { message: 'Invite rejected' };
}

export async function cancelInvite(
  userId: string,
  conversationId: string,
  inviteId: string
) {
  await checkAdminPermission(userId, conversationId);
  
  const invite = await inviteRepo().findOneBy({ id: inviteId, conversationId });
  
  if (!invite) {
    throw new Error('Invite not found');
  }
  
  if (invite.status !== 'PENDING') {
    throw new Error('Cannot cancel non-pending invite');
  }
  
  if (invite.invitedBy !== userId) {
    throw new Error('Only the inviter can cancel this invite');
  }
  
  await inviteRepo().update(inviteId, { status: 'CANCELLED' });
  
  return { message: 'Invite cancelled' };
}

// 4. Quản lý Poll (Bình chọn)

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
    createdAt: new Date()
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
    expiresAt
  });
  
  await pollRepo().save(poll);
  
  return poll;
}

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
  
  // Get vote counts for each poll
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
      userVote: voteMap.get(poll.id)?.find(v => v.userId === userId)
    })),
    meta: {
      total: polls.length,
      page,
      limit,
      totalPages: Math.ceil(polls.length / limit),
      hasNext: polls.length >= limit,
      hasPrev: page > 1
    }
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
    userVote
  };
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
  
  // Update option labels if provided
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
  
  const updatedPoll = await pollRepo().findOneBy({ id: pollId });
  
  return updatedPoll;
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
  
  // Validate option IDs
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
  
  // Remove existing vote
  await voteRepo().delete({ pollId, userId });
  
  // Add new vote
  await voteRepo().save(voteRepo().create({
    id: uuid(),
    pollId,
    userId,
    optionIds
  }));
  
  // Update option vote counts
  const votes = await voteRepo().findBy({ pollId });
  const voteCounts = new Map<string, number>();
  
  votes.forEach(vote => {
    vote.optionIds.forEach(optionId => {
      voteCounts.set(optionId, (voteCounts.get(optionId) || 0) + 1);
    });
  });
  
  const updatedOptions = poll.options.map((option: PollOption) => ({
    ...option,
    votes: voteCounts.get(option.id) || 0
  }));
  
  await pollRepo().update(pollId, { options: updatedOptions });
  
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
  
  // Update option vote counts
  const votes = await voteRepo().findBy({ pollId });
  const voteCounts = new Map<string, number>();
  
  votes.forEach(vote => {
    vote.optionIds.forEach(optionId => {
      voteCounts.set(optionId, (voteCounts.get(optionId) || 0) + 1);
    });
  });
  
  const updatedOptions = poll.options.map((option: PollOption) => ({
    ...option,
    votes: voteCounts.get(option.id) || 0
  }));
  
  await pollRepo().update(pollId, { options: updatedOptions });
  
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
    createdAt: new Date()
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
  
  const member = await checkMembership(userId, conversationId);
  const canClose = poll.createdBy === userId || 
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
    closedBy: userId 
  });
  
  const updatedPoll = await pollRepo().findOneBy({ id: pollId });
  
  return updatedPoll;
}

// 5. Quản lý Call (Cuộc gọi)

export async function getIceServers() {
  // Mock ICE servers - in production, configure with real TURN/STUN servers
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
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
      hasPrev: page > 1
    }
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
  const canEnd = call.startedBy === userId || 
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
    endReason: reason
  });
  
  const updatedCall = await callRepo().findOneBy({ id: callId });
  
  return updatedCall;
}

// 6. Các chức năng khác

export async function markAsRead(
  userId: string,
  conversationId: string
) {
  const member = await checkMembership(userId, conversationId);
  
  await memberRepo().update({ conversationId, userId }, { 
    lastReadAt: new Date() 
  });
  
  return { message: 'Conversation marked as read' };
}

export async function pinConversation(
  userId: string,
  conversationId: string
) {
  await checkMembership(userId, conversationId);
  
  const existing = await pinnedRepo().findOneBy({ userId, conversationId });
  if (existing) {
    throw new Error('Conversation is already pinned');
  }
  
  await pinnedRepo().save(pinnedRepo().create({
    userId,
    conversationId,
    pinnedAt: new Date()
  }));
  
  return { message: 'Conversation pinned' };
}

export async function unpinConversation(
  userId: string,
  conversationId: string
) {
  await checkMembership(userId, conversationId);
  
  const existing = await pinnedRepo().findOneBy({ userId, conversationId });
  if (!existing) {
    throw new Error('Conversation is not pinned');
  }
  
  await pinnedRepo().delete({ userId, conversationId });
  
  return { message: 'Conversation unpinned' };
}

export async function updateGroupSettings(
  userId: string,
  conversationId: string,
  permissions?: ConversationPermissions,
  policies?: ConversationPolicies,
  features?: ConversationFeatures
) {
  await checkOwnerPermission(userId, conversationId);
  
  const existing = await settingsRepo().findOneBy({ conversationId });
  
  const updateData: any = {};
  if (permissions !== undefined) updateData.permissions = permissions;
  if (policies !== undefined) updateData.policies = policies;
  if (features !== undefined) updateData.features = features;
  
  if (existing) {
    await settingsRepo().update({ conversationId }, updateData);
  } else {
    await settingsRepo().save(settingsRepo().create({
      conversationId,
      ...updateData
    }));
  }
  
  const updated = await settingsRepo().findOneBy({ conversationId });
  
  return updated;
}

export async function disbandGroup(
  userId: string,
  conversationId: string
) {
  await checkOwnerPermission(userId, conversationId);
  
  const conversation = await conversationRepo().findOneBy({ id: conversationId });
  if (conversation?.type === 'DIRECT') {
    throw new Error('Cannot disband direct conversation');
  }
  
  // Remove all members
  await memberRepo().delete({ conversationId });
  
  // Delete conversation
  await conversationRepo().delete({ id: conversationId });
  
  return { message: 'Group disbanded successfully' };
}
