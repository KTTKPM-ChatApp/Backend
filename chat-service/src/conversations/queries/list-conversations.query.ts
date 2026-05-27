import { fetchUsersInfo } from '../../auth-client';
import { cacheGet, cacheSet, CONVERSATION_CACHE_TTL } from '../../redis';
import {
  ConversationMember,
  UserPinnedConversation,
  conversationRepo,
  formatLastMessagePreview,
  memberRepo,
  messageRepo,
  pinnedRepo,
  summaryRepo,
} from '../shared/conversation-context';

export async function listConversations(userId: string, page: number = 1, limit: number = 20) {
  const cacheKey = `convlist:${userId}:${page}:${limit}`;
  const cached = await cacheGet<{ data: any[]; meta: any }>(cacheKey);
  if (cached) return cached;

  const offset = (page - 1) * limit;

  const summaries = await summaryRepo()
    .createQueryBuilder('s')
    .where('s.user_id = :userId', { userId })
    .orderBy('s.last_message_at', 'DESC')
    .addOrderBy('s.conversation_id', 'DESC')
    .limit(limit)
    .offset(offset)
    .getMany();

  if (summaries.length > 0) {
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
        let name = s.conversationTitle || 'Cuoc tro chuyen';
        if (s.conversationType === 'DIRECT' && otherMember?.displayName) {
          name = otherMember.displayName;
        }
        const lastMessage = s.lastMessageId ? {
          id: s.lastMessageId,
          content: s.lastMessagePreview || '',
          createdAt: s.lastMessageAt,
          senderId: s.lastSenderId,
          senderName: (s.lastSenderId ? userInfoMap.get(s.lastSenderId)?.displayName : null) || s.lastSenderName || 'Nguoi dung',
        } : undefined;
        return {
          id: s.conversationId,
          type: s.conversationType,
          title: s.conversationTitle,
          avatarUrl: s.conversationAvatar,
          name,
          members: convMembers,
          isPinned: pinnedSet.has(s.conversationId),
          isMuted: (convMembers.find((m: any) => m.userId === userId) as any)?.isMuted ?? false,
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
        hasPrev: page > 1,
      },
    };
  }

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
        senderName: senderInfo?.displayName || 'Nguoi dung',
      });
    }
  }

  const result = {
    data: conversations.map(c => {
      const members = memberMap.get(c.id) || [];
      const otherMember = members.find(m => m.userId !== userId);
      let name = c.title || 'Cuoc tro chuyen';
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
      hasPrev: page > 1,
    },
  };

  cacheSet(cacheKey, result, CONVERSATION_CACHE_TTL);
  return result;
}
