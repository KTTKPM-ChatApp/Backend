import { v4 as uuid } from 'uuid';
import {
  AppDataSource,
  Conversation,
  ConversationMember,
  Message,
  ConversationSummary,
  ConversationInvite,
  ConversationPoll,
  PollVote,
  ConversationCall,
  GroupCallSession,
  GroupCallParticipant,
  ConversationSettings,
  UserPinnedConversation,
  PollOption,
  CallParticipant,
  ConversationPermissions,
  ConversationPolicies,
  ConversationFeatures
} from '../db';
import { fetchUsersInfo, fetchUserInfo } from '../auth-client';
import { notifyNewConversation, notifySystemEvent, notifyCallStarted, notifyGroupCallStarted } from '../notifier';
import { cacheGet, cacheSet, cacheDeletePattern, CONVERSATION_CACHE_TTL } from '../redis';

function invalidateConversationListCache(memberIds: string[]) {
  memberIds.forEach(memberId => {
    cacheDeletePattern(`convlist:${memberId}:*`).catch(() => {});
  });
}

async function resolveDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  const map = await fetchUsersInfo(userIds);
  const result = new Map<string, string>();
  for (const id of userIds) {
    result.set(id, map.get(id)?.displayName ?? id);
  }
  return result;
}

async function persistAndNotifySystemEvent(
  conversationId: string,
  senderId: string,
  systemEventType: string,
  metadata: Record<string, any>
) {
  const messageId = uuid();
  const now = new Date();

  const message = messageRepo().create({
    id: messageId,
    conversationId,
    senderId,
    contentType: 'SYSTEM',
    content: '',
    type: 'system',
    messageType: 'system',
    systemEventType,
    metadata,
    createdAt: now,
    updatedAt: now,
  });
  await messageRepo().save(message);

  notifySystemEvent({
    messageId,
    conversationId,
    senderId,
    systemEventType,
    metadata,
  }, now.toISOString()).catch(() => {});
}

// Repository getters
const conversationRepo = () => AppDataSource.getRepository(Conversation);
const memberRepo = () => AppDataSource.getRepository(ConversationMember);
const messageRepo = () => AppDataSource.getRepository(Message);
const summaryRepo = () => AppDataSource.getRepository(ConversationSummary);
const inviteRepo = () => AppDataSource.getRepository(ConversationInvite);
const pollRepo = () => AppDataSource.getRepository(ConversationPoll);
const voteRepo = () => AppDataSource.getRepository(PollVote);
const callRepo = () => AppDataSource.getRepository(ConversationCall);
const groupSessionRepo = () => AppDataSource.getRepository(GroupCallSession);
const groupParticipantRepo = () => AppDataSource.getRepository(GroupCallParticipant);
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

function formatLastMessagePreview(msg: Message): string {
  if (msg.content && msg.content.trim()) return msg.content;
  if (!msg.attachments || msg.attachments.length === 0) return msg.content || '';
  const types = msg.attachments.map(a => a.type);
  if (types.includes('image')) return 'Đã gửi 1 ảnh';
  if (types.includes('video')) return 'Đã gửi 1 video';
  if (types.includes('audio')) return 'Đã gửi 1 tin nhắn thoại';
  return 'Đã gửi 1 tệp đính kèm';
}

export async function listConversations(userId: string, page: number = 1, limit: number = 20) {
  const cacheKey = `convlist:${userId}:${page}:${limit}`;
  const cached = await cacheGet<{ data: any[]; meta: any }>(cacheKey);
  if (cached) return cached;

  const offset = (page - 1) * limit;

  // Try read model first (conversation_summaries)
  const summaries = await summaryRepo()
    .createQueryBuilder('s')
    .where('s.user_id = :userId', { userId })
    .orderBy('s.last_message_at', 'DESC')
    .addOrderBy('s.conversation_id', 'DESC')
    .limit(limit)
    .offset(offset)
    .getMany();

  if (summaries.length > 0) {
    // Read model is populated — build response from summaries
    const conversationIds = summaries.map(s => s.conversationId);
    const members = await memberRepo()
      .createQueryBuilder('m')
      .where('m.conversation_id IN (:...ids)', { ids: conversationIds })
      .getMany();

    const memberMap = new Map<string, any[]>();
    members.forEach(m => {
      if (!memberMap.has(m.conversationId)) memberMap.set(m.conversationId, []);
      memberMap.get(m.conversationId)!.push({
        userId: m.userId,
        displayName: null as string | null,
        avatarUrl: null as string | null,
        role: m.role,
        isMuted: m.isMuted,
        nickname: m.nickname,
      });
    });

    const userIds = members.map(m => m.userId);
    const userInfoMap = await fetchUsersInfo(userIds);
    for (const [, convMembers] of memberMap) {
      for (const m of convMembers) {
        const info = userInfoMap.get(m.userId);
        if (info) {
          m.displayName = info.displayName;
          m.avatarUrl = info.avatarUrl;
        }
      }
    }

    const pinned = await pinnedRepo()
      .createQueryBuilder('p')
      .where('p.conversation_id IN (:...ids) AND p.user_id = :userId', { ids: conversationIds, userId })
      .getMany();
    const pinnedSet = new Set(pinned.map(p => p.conversationId));

    const result = {
      data: summaries.map(s => {
        const convMembers = memberMap.get(s.conversationId) || [];
        const otherMember = convMembers.find((m: any) => m.userId !== userId);
        let name = s.conversationTitle || 'Cuộc trò chuyện';
        if (s.conversationType === 'DIRECT' && otherMember?.displayName) {
          name = otherMember.displayName;
        }
        const lastMessage = s.lastMessageId ? {
          id: s.lastMessageId,
          content: s.lastMessagePreview || '',
          createdAt: s.lastMessageAt,
          senderId: s.lastSenderId,
          senderName: (s.lastSenderId ? userInfoMap.get(s.lastSenderId)?.displayName : null) || s.lastSenderName || 'Người dùng',
        } : undefined;
        return {
          id: s.conversationId,
          type: s.conversationType,
          title: s.conversationTitle,
          avatarUrl: s.conversationAvatar,
          name,
          members: convMembers,
          memberCount: convMembers.length,
          isPinned: pinnedSet.has(s.conversationId),
          isMuted: (convMembers.find((m: any) => m.userId === userId) as any)?.isMuted ?? false,
          unreadCount: s.unreadCount ?? 0,
          lastMessageAt: s.lastMessageAt,
          createdAt: s.createdAt,
          lastMessage,
        };
      }),
      meta: {
        total: summaries.length,
        page,
        limit,
        totalPages: Math.ceil(summaries.length / limit),
        hasNext: summaries.length >= limit,
        hasPrev: page > 1,
      },
    };

    cacheSet(cacheKey, result, CONVERSATION_CACHE_TTL);
    return result;
  }

  // Fallback: legacy query (read model not yet built — e.g. first deploy)
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
  members.forEach(m => {
    if (!memberMap.has(m.conversationId)) memberMap.set(m.conversationId, []);
    const memberData = {
      userId: m.userId,
      displayName: null as string | null,
      avatarUrl: null as string | null,
      role: m.role,
      isMuted: m.isMuted,
      nickname: m.nickname,
    };
    memberMap.get(m.conversationId)!.push(memberData);
  });

  const userIds = members.map(m => m.userId);
  const userInfoMap = await fetchUsersInfo(userIds);
  for (const [convId, convMembers] of memberMap) {
    for (const m of convMembers) {
      const info = userInfoMap.get(m.userId);
      if (info) {
        m.displayName = info.displayName;
        m.avatarUrl = info.avatarUrl;
      }
    }
  }
  
  const pinned = await pinnedRepo()
    .createQueryBuilder('p')
    .where('p.conversation_id IN (:...ids) AND p.user_id = :userId', { ids: conversationIds, userId })
    .getMany();
  
  const pinnedSet = new Set(pinned.map(p => p.conversationId));

  // Fetch last message details for each conversation
  const lastMessageIds = conversations.map(c => c.lastMessageId).filter(Boolean) as string[];
  const lastMessageData = new Map<string, { id: string; content: string; createdAt: Date; senderId: string; senderName: string }>();
  if (lastMessageIds.length > 0) {
    const messages = await messageRepo()
      .createQueryBuilder('m')
      .where('m.id IN (:...ids)', { ids: lastMessageIds })
      .getMany();
    const senderIds = [...new Set(messages.filter(m => m.senderId).map(m => m.senderId))];
    const userInfoMap2 = await fetchUsersInfo(senderIds);
    for (const msg of messages) {
      const senderInfo = userInfoMap2.get(msg.senderId);
      lastMessageData.set(msg.conversationId, {
        id: msg.id,
        content: formatLastMessagePreview(msg),
        createdAt: msg.createdAt,
        senderId: msg.senderId,
        senderName: senderInfo?.displayName || 'Người dùng',
      });
    }
  }

  const result = {
    data: conversations.map(c => {
      const members = memberMap.get(c.id) || [];
      const otherMember = members.find(m => m.userId !== userId);
      let name = c.title || 'Cuộc trò chuyện';
      if (c.type === 'DIRECT' && otherMember?.displayName) {
        name = otherMember.displayName;
      }
      const lmData = c.lastMessageId ? lastMessageData.get(c.id) : undefined;
      const lastMessage = lmData ? {
        id: lmData.id,
        content: lmData.content,
        createdAt: lmData.createdAt,
        senderId: lmData.senderId,
        senderName: lmData.senderName,
      } : undefined;
      return {
        ...c,
        name,
        members,
        isPinned: pinnedSet.has(c.id),
        isMuted: (members.find((m: any) => m.userId === userId) as any)?.isMuted ?? false,
        lastMessage,
      };
    }),
    meta: {
      total: conversations.length,
      page,
      limit,
      totalPages: Math.ceil(conversations.length / limit),
      hasNext: conversations.length >= limit,
      hasPrev: page > 1
    }
  };

  cacheSet(cacheKey, result, CONVERSATION_CACHE_TTL);
  return result;
}

export async function getConversationById(userId: string, conversationId: string) {
  await checkMembership(userId, conversationId);
  
  const conversation = await conversationRepo().findOneBy({ id: conversationId });
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  const members = await memberRepo().findBy({ conversationId });
  const userInfoMap = await fetchUsersInfo(members.map(m => m.userId));
  const enrichedMembers = members.map(m => ({
    userId: m.userId,
    displayName: userInfoMap.get(m.userId)?.displayName ?? null,
    avatarUrl: userInfoMap.get(m.userId)?.avatarUrl ?? null,
    role: m.role,
  }));

  let lastMessage: { id: string; content: string; createdAt: Date; senderId: string; senderName: string } | undefined;
  if (conversation.lastMessageId) {
    const msg = await messageRepo().findOneBy({ id: conversation.lastMessageId });
    if (msg) {
      const userInfoMap2 = await fetchUsersInfo([msg.senderId]);
      const senderInfo = userInfoMap2.get(msg.senderId);
      lastMessage = {
        id: msg.id,
        content: formatLastMessagePreview(msg),
        createdAt: msg.createdAt,
        senderId: msg.senderId,
        senderName: senderInfo?.displayName || 'Người dùng',
      };
    }
  }

  return {
    ...conversation,
    members: enrichedMembers,
    lastMessage,
  };
}

export async function createGroupConversation(
  createdBy: string,
  name: string,
  memberIds: string[],
  avatarUrl?: string,
  description?: string
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
    avatarUrl,
    description: description?.trim() || undefined
  });
  await conversationRepo().save(conversation);
  
  const allMemberIds = [createdBy, ...uniqueMembers];
  await memberRepo().save(allMemberIds.map(userId => 
    memberRepo().create({ 
      conversationId: conversation.id, 
      userId,
      role: userId === createdBy ? 'OWNER' : 'MEMBER',
      joinedAt: new Date()
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

  // Eagerly seed conversation_summary for all members (visible immediately)
  await Promise.allSettled(
    allMemberIds.map(userId =>
      summaryRepo().upsert({
        userId,
        conversationId: conversation.id,
        conversationType: 'GROUP',
        conversationTitle: name.trim(),
        conversationAvatar: avatarUrl || undefined,
      }, ['userId', 'conversationId'])
    )
  );

  // Invalidate conversation list cache for all members
  invalidateConversationListCache(allMemberIds);

  // Notify all members via realtime-service (STOMP)
  notifyNewConversation({
    conversationId: conversation.id,
    type: 'GROUP',
    createdBy,
    memberIds: allMemberIds,
    title: name.trim(),
  }).catch((err: any) => console.error('[createGroupConversation] notifyNewConversation error:', err));

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
    const existingMembers = await memberRepo().findBy({ conversationId: existing.id });
    
    if (existingMembers.length === 0) {
      await conversationRepo().delete(existing.id);
    } else {
      const userInfoMap = await fetchUsersInfo(existingMembers.map(m => m.userId));
      const enrichedMembers = existingMembers.map(m => ({
        userId: m.userId,
        displayName: userInfoMap.get(m.userId)?.displayName ?? null,
        role: m.role,
      }));
      // Tìm displayName của participant (người kia trong direct conversation)
      const otherMemberId = existingMembers.find(m => m.userId !== createdBy)?.userId;
      let name = existing.title || 'Cuộc trò chuyện';
      if (otherMemberId) {
        const otherUserInfo = userInfoMap.get(otherMemberId);
        name = otherUserInfo?.displayName ?? otherUserInfo?.username ?? name;
      }
      return {
        ...existing,
        name,
        members: enrichedMembers,
      };
    }
  }
  
  const otherUserInfo = await fetchUserInfo(participantId);
  const title = otherUserInfo?.displayName ?? participantId;

  const conversation = conversationRepo().create({
    id: uuid(),
    type: 'DIRECT',
    createdBy,
    directKey,
    title,
  });
  await conversationRepo().save(conversation);
  
  const memberIds = [createdBy, participantId];
  
  for (const userId of memberIds) {
    const memberEntity = memberRepo().create({ 
      conversationId: conversation.id, 
      userId,
      joinedAt: new Date()
    });
    try {
      await memberRepo().save(memberEntity);
    } catch (err) {
      console.error('[createDirectConversation] Error saving member:', userId, err);
      throw err;
    }
  }
  
  const members = await memberRepo()
    .createQueryBuilder('m')
    .where('m.conversation_id = :convId', { convId: conversation.id })
    .getMany();
  const userInfoMap = await fetchUsersInfo(members.map(m => m.userId));
  const enrichedMembers = members.map(m => ({
    userId: m.userId,
    displayName: userInfoMap.get(m.userId)?.displayName ?? null,
    role: m.role,
  }));

  // Eagerly seed conversation_summary for both members
  await Promise.allSettled(
    memberIds.map(userId =>
      summaryRepo().upsert({
        userId,
        conversationId: conversation.id,
        conversationType: 'DIRECT',
        conversationTitle: title,
      }, ['userId', 'conversationId'])
    )
  );

  // Invalidate conversation list cache for both members
  invalidateConversationListCache(memberIds);

  return {
    ...conversation,
    name: title,
    members: enrichedMembers,
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
  const memberIds = members.map(m => m.userId);

  if (name !== undefined || avatarUrl !== undefined) {
    // Update conversation summaries for all members
    await Promise.allSettled(
      memberIds.map(memberId =>
        summaryRepo().upsert({
          userId: memberId,
          conversationId,
          conversationTitle: name !== undefined ? name.trim() : undefined,
          conversationAvatar: avatarUrl !== undefined ? avatarUrl : undefined,
        }, ['userId', 'conversationId'])
      )
    );

    // Invalidate cache for all members
    invalidateConversationListCache(memberIds);
    
    const updaterName = (await fetchUserInfo(userId))?.displayName ?? userId;
    const events: Array<{ type: string; metadata: Record<string, any> }> = [];

    if (name !== undefined) {
      events.push({
        type: 'CONVERSATION_UPDATED',
        metadata: {
          updated_by_name: updaterName,
          updated_by_id: userId,
          field: 'name',
          new_value: name.trim(),
        },
      });
    }

    if (avatarUrl !== undefined) {
      events.push({
        type: 'CONVERSATION_UPDATED',
        metadata: {
          updated_by_name: updaterName,
          updated_by_id: userId,
          field: 'avatar',
          new_value: avatarUrl,
        },
      });
    }

    for (const event of events) {
      persistAndNotifySystemEvent(conversationId, userId, event.type, event.metadata)
        .catch((err: any) => console.error('[updateConversation] persistAndNotifySystemEvent error:', err));
    }
  }
  
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
  const currentMember = await checkMembership(userId, conversationId);
  
  const conversation = await conversationRepo().findOneBy({ id: conversationId });
  if (conversation?.type === 'DIRECT') {
    throw new Error('Cannot add members to direct conversation');
  }
  
  const settings = await settingsRepo().findOneBy({ conversationId });
  const canAddMembers =
    currentMember.role === 'OWNER' ||
    currentMember.role === 'ADMIN' ||
    settings?.permissions?.canAddMembers !== false;

  if (!canAddMembers) {
    throw new Error('You do not have permission to add members');
  }

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
    memberRepo().create({ conversationId, userId, role: 'MEMBER', joinedAt: new Date() })
  ));

  // Seed conversation_summary for new members
  await Promise.allSettled(
    newMemberIds.map(memberId =>
      summaryRepo().upsert({
        userId: memberId,
        conversationId,
        conversationType: conversation?.type || 'GROUP',
        conversationTitle: conversation?.title || undefined,
        conversationAvatar: conversation?.avatarUrl || undefined,
      }, ['userId', 'conversationId'])
    )
  );

  // Invalidate conversation list cache for ALL members (existing + new)
  const allMemberIds = [...existingMembers.map(m => m.userId), ...newMemberIds];
  invalidateConversationListCache(allMemberIds);

  const displayNames = await resolveDisplayNames([userId, ...newMemberIds]);

  if (conversation) {
    notifyNewConversation({
      conversationId,
      type: conversation.type,
      createdBy: userId,
      memberIds: newMemberIds,
      title: conversation.title,
    }).catch((err: any) => console.error('[addMembers] notifyNewConversation error:', err));
  }

  persistAndNotifySystemEvent(
    conversationId,
    userId,
    'MEMBER_ADDED',
    {
      added_by_name: displayNames.get(userId)!,
      added_members: newMemberIds.map((id: string) => ({ full_name: displayNames.get(id!) })),
    }
  );

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

  // Clean up summary for removed member
  await summaryRepo().delete({ userId: memberId, conversationId }).catch(() => {});
  // Invalidate cache for ALL members of the conversation
  invalidateConversationListCache(allMembers.map(m => m.userId));

  const removerName = (await fetchUserInfo(userId))?.displayName ?? userId;
  const removedName = (await fetchUserInfo(memberId))?.displayName ?? memberId;

  persistAndNotifySystemEvent(
    conversationId,
    userId,
    'MEMBER_REMOVED',
    {
      removed_by_name: removerName,
      removed_user_name: removedName,
      removed_user_id: memberId,
    }
  );

  return { message: 'Member removed successfully' };
}

export async function leaveConversation(
  userId: string,
  conversationId: string
) {
  const member = await checkMembership(userId, conversationId);
  
  const allMembers = await memberRepo().findBy({ conversationId });
  if (member.role === 'OWNER') {
    if (allMembers.length > 1) {
      throw new Error('Owner cannot leave group with other members. Transfer ownership first.');
    }
  }
  
  await memberRepo().delete({ conversationId, userId });

  // Clean up summary for leaving member
  await summaryRepo().delete({ userId, conversationId }).catch(() => {});
  // Invalidate cache for ALL members of the conversation
  invalidateConversationListCache(allMembers.map(m => m.userId));

  const leftName = (await fetchUserInfo(userId))?.displayName ?? userId;

  persistAndNotifySystemEvent(
    conversationId,
    userId,
    'MEMBER_LEFT',
    { user_name: leftName, user_id: userId }
  );

  return { message: 'Left conversation successfully' };
}

export async function transferOwnership(
  userId: string,
  conversationId: string,
  newOwnerId: string
) {
  await checkOwnerPermission(userId, conversationId);
  
  if (userId === newOwnerId) {
    throw new Error('Cannot transfer ownership to yourself');
  }
  
  const newOwner = await memberRepo().findOneBy({ conversationId, userId: newOwnerId });
  if (!newOwner) {
    throw new Error('New owner not found');
  }
  
  await memberRepo().update(
    { conversationId, userId },
    { role: 'ADMIN' }
  );
  
  await memberRepo().update(
    { conversationId, userId: newOwnerId },
    { role: 'OWNER' }
  );

  const ownerNames = await resolveDisplayNames([userId, newOwnerId]);

  persistAndNotifySystemEvent(
    conversationId,
    userId,
    'OWNER_TRANSFERRED',
    {
      previous_owner_name: ownerNames.get(userId)!,
      new_owner_name: ownerNames.get(newOwnerId)!,
    }
  );

  return { message: 'Ownership transferred successfully' };
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

  const roleNames = await resolveDisplayNames([userId, memberId]);

  persistAndNotifySystemEvent(
    conversationId,
    userId,
    'ROLE_CHANGED',
    {
      updated_by_name: roleNames.get(userId)!,
      target_user_name: roleNames.get(memberId)!,
      new_role: newRole === 'ADMIN' ? 'co_owner' : 'member',
    }
  );

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
  
  // Invalidate cache so muted/nickname reflects immediately
  invalidateConversationListCache([userId]);
  
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
    role: 'MEMBER',
    joinedAt: new Date()
  }));

  const conversation = await conversationRepo().findOneBy({ id: conversationId });

  // Seed summary for new member
  await summaryRepo().upsert({
    userId,
    conversationId,
    conversationType: conversation?.type || 'GROUP',
    conversationTitle: conversation?.title || undefined,
    conversationAvatar: conversation?.avatarUrl || undefined,
  }, ['userId', 'conversationId']);

  // Invalidate cache for the accepting user
  invalidateConversationListCache([userId]);

  // Notify new member about the conversation
  if (conversation) {
    notifyNewConversation({
      conversationId,
      type: conversation.type,
      createdBy: conversation.createdBy,
      memberIds: [userId],
      title: conversation.title,
    }).catch((err: any) => console.error('[acceptInvite] notifyNewConversation error:', err));
  }
  
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
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: process.env.TURN_URL || 'turn:coturn:3478',
        username: process.env.TURN_USERNAME || 'zalo',
        credential: process.env.TURN_CREDENTIAL || 'zalosecret',
      },
    ],
  };
}

export async function startCall(
  userId: string,
  conversationId: string,
  type: 'AUDIO' | 'VIDEO'
) {
  await checkMembership(userId, conversationId);

  const activeCall = await callRepo()
    .createQueryBuilder('c')
    .where('c.conversation_id = :conversationId', { conversationId })
    .andWhere('c.status = :status', { status: 'ONGOING' })
    .getOne();

  if (activeCall) {
    // Safety net: auto-end stale calls from failed cleanup
    // Stale = only caller participant OR older than 60s with no answer
    const hasOtherParticipants = activeCall.participants.some(p => p.userId !== userId);
    const ageSeconds = (Date.now() - new Date(activeCall.startedAt).getTime()) / 1000;
    if (!hasOtherParticipants || ageSeconds > 60) {
      await callRepo().update(activeCall.id, {
        status: 'FAILED',
        endedAt: new Date(),
        endedBy: userId,
        endReason: 'auto-ended: stale call',
      });
    } else {
      throw new Error('There is already an active call in this conversation');
    }
  }

  const callId = uuid();
  const now = new Date();

  const call = callRepo().create({
    id: callId,
    conversationId,
    startedBy: userId,
    type,
    status: 'ONGOING',
    startedAt: now,
    participants: [{ userId, joinedAt: now }],
  });
  await callRepo().save(call);

  const callerInfo = await fetchUserInfo(userId);
  notifyCallStarted({
    callId,
    conversationId,
    startedBy: userId,
    type,
    callerName: callerInfo?.displayName ?? userId,
    callerAvatarUrl: callerInfo?.avatarUrl ?? null,
    memberIds: (await memberRepo().findBy({ conversationId })).map(m => m.userId),
  }).catch(() => {});

  return call;
}

export async function joinCall(
  userId: string,
  conversationId: string,
  callId: string
) {
  await checkMembership(userId, conversationId);

  const call = await callRepo().findOneBy({ id: callId, conversationId });
  if (!call) throw new Error('Call not found');
  if (call.status !== 'ONGOING') throw new Error('Call is not ongoing');

  const participant = call.participants.find(p => p.userId === userId);
  if (participant) return call;

  call.participants = [...call.participants, { userId, joinedAt: new Date() }];
  await callRepo().save(call);

  return call;
}

export async function rejectCall(
  userId: string,
  conversationId: string,
  callId: string
) {
  await checkMembership(userId, conversationId);

  const call = await callRepo().findOneBy({ id: callId, conversationId });
  if (!call) throw new Error('Call not found');

  // P2P call: if nobody else has joined, rejection ends the call
  // (this handles both caller cancelling and callee rejecting)
  if (call.participants.length <= 1) {
    call.status = 'REJECTED';
    call.endedAt = new Date();
    call.endedBy = userId;
    call.endReason = 'rejected';
    await callRepo().save(call);
  }

  return { message: 'Call rejected' };
}

// Group Call (SFU-based)
export async function createGroupCallSession(
  userId: string,
  conversationId: string
) {
  await checkMembership(userId, conversationId);

  const conversation = await conversationRepo().findOneBy({ id: conversationId });
  if (!conversation || conversation.type !== 'GROUP') {
    throw new Error('Group calls are only available in group conversations');
  }

  const activeSession = await groupSessionRepo()
    .createQueryBuilder('gs')
    .where('gs.conversation_id = :conversationId', { conversationId })
    .andWhere('gs.status = :status', { status: 'ACTIVE' })
    .getOne();

  if (activeSession) {
    throw new Error('There is already an active group call in this conversation');
  }

  const sessionId = uuid();
  const sfuRoomId = `sfu_room_${conversationId}`;
  const now = new Date();

  const session = groupSessionRepo().create({
    id: sessionId,
    conversationId,
    hostId: userId,
    sfuRoomId,
    status: 'ACTIVE',
    startedAt: now,
  });
  await groupSessionRepo().save(session);

  const participant = groupParticipantRepo().create({
    id: uuid(),
    sessionId,
    userId,
    sfuPeerId: `${userId}_${sessionId}`,
    joinedAt: now,
    isAudioEnabled: true,
    isVideoEnabled: true,
  });
  await groupParticipantRepo().save(participant);

  const allMemberIds = (await memberRepo().findBy({ conversationId })).map(m => m.userId);

  const callerInfo = await fetchUserInfo(userId);
  notifyGroupCallStarted({
    sessionId,
    conversationId,
    sfuRoomId,
    startedBy: userId,
    hostId: userId,
    callerName: callerInfo?.displayName ?? userId,
    callerAvatarUrl: callerInfo?.avatarUrl ?? null,
    memberIds: allMemberIds,
  }).catch(() => {});

  return { session, participant };
}

export async function joinGroupCallSession(
  userId: string,
  conversationId: string,
  sessionId: string
) {
  await checkMembership(userId, conversationId);

  const session = await groupSessionRepo().findOneBy({ id: sessionId, conversationId });
  if (!session) throw new Error('Group call session not found');
  if (session.status !== 'ACTIVE') throw new Error('Group call is not active');

  const existing = await groupParticipantRepo().findOneBy({ sessionId, userId });
  if (existing) return { session, participant: existing };

  const participant = groupParticipantRepo().create({
    id: uuid(),
    sessionId,
    userId,
    sfuPeerId: `${userId}_${sessionId}`,
    joinedAt: new Date(),
    isAudioEnabled: true,
    isVideoEnabled: true,
  });
  await groupParticipantRepo().save(participant);

  return { session, participant };
}

export async function leaveGroupCallSession(
  userId: string,
  conversationId: string,
  sessionId: string
) {
  const session = await groupSessionRepo().findOneBy({ id: sessionId, conversationId });
  if (!session) throw new Error('Group call session not found');

  const participant = await groupParticipantRepo().findOneBy({ sessionId, userId });
  if (participant) {
    participant.leftAt = new Date();
    await groupParticipantRepo().save(participant);
  }

  if (session.hostId === userId) {
    const remaining = await groupParticipantRepo().findBy({ sessionId, leftAt: null as any });
    if (remaining.length === 0) {
      session.status = 'ENDED';
      session.endedAt = new Date();
      await groupSessionRepo().save(session);
    }
  }

  return { message: 'Left group call' };
}

export async function endGroupCallSession(
  userId: string,
  conversationId: string,
  sessionId: string
) {
  const session = await groupSessionRepo().findOneBy({ id: sessionId, conversationId });
  if (!session) throw new Error('Group call session not found');

  const isHost = session.hostId === userId;
  const isAdmin = (await checkMembership(userId, conversationId)).role === 'OWNER' || 
                  (await checkMembership(userId, conversationId)).role === 'ADMIN';

  if (!isHost && !isAdmin) {
    throw new Error('Only the host or admin can end the group call');
  }

  session.status = 'ENDED';
  session.endedAt = new Date();
  await groupSessionRepo().save(session);

  const participants = await groupParticipantRepo().findBy({ sessionId });
  for (const p of participants) {
    if (!p.leftAt) {
      p.leftAt = new Date();
      await groupParticipantRepo().save(p);
    }
  }

  return { message: 'Group call ended' };
}

export async function getGroupCallSession(
  userId: string,
  conversationId: string
) {
  await checkMembership(userId, conversationId);

  const session = await groupSessionRepo()
    .createQueryBuilder('gs')
    .where('gs.conversation_id = :conversationId', { conversationId })
    .andWhere('gs.status = :status', { status: 'ACTIVE' })
    .leftJoinAndSelect('GroupCallParticipant', 'gp', 'gp.session_id = gs.id')
    .getOne();

  if (!session) return null;

  const participants = await groupParticipantRepo().findBy({ sessionId: session.id });
  return { session, participants };
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
  
  await checkMembership(userId, conversationId);
  
  const endedAt = new Date();
  const durationSeconds = Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000);
  await callRepo().update(callId, {
    status: 'ENDED',
    endedAt,
    endedBy: userId,
    endReason: reason,
    durationSeconds: durationSeconds,
  });
  
  const callerDisplayNames = await resolveDisplayNames([call.startedBy]);
  const callerName = callerDisplayNames.get(call.startedBy) || 'Unknown';
  persistAndNotifySystemEvent(
    conversationId,
    call.startedBy,
    'CALL_LOG',
    {
      callId,
      callType: call.type,
      duration: durationSeconds,
      startedAt: call.startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      endedBy: userId,
      callerName,
    }
  );
  
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
  
  await summaryRepo().update({ userId, conversationId }, { unreadCount: 0 });
  
  cacheDeletePattern(`convlist:${userId}:*`);
  
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

  // Invalidate cache so pinned status reflects immediately
  invalidateConversationListCache([userId]);
  
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

  // Invalidate cache so unpinned status reflects immediately
  invalidateConversationListCache([userId]);
  
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

  // Get all members before deleting
  const allMembers = await memberRepo().findBy({ conversationId });
  const allMemberIds = allMembers.map(m => m.userId);

  const disbandName = (await fetchUserInfo(userId))?.displayName ?? userId;

  persistAndNotifySystemEvent(
    conversationId,
    userId,
    'GROUP_DISBANDED',
    { disbanded_by_name: disbandName }
  );

  // Invalidate cache for all members
  invalidateConversationListCache(allMemberIds);

  // Remove all members
  await memberRepo().delete({ conversationId });
  
  // Delete conversation
  await conversationRepo().delete({ id: conversationId });
  
  return { message: 'Group disbanded successfully' };
}
