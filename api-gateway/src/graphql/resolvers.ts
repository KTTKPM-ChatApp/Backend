import axios from 'axios';
import DataLoader from 'dataloader';
import { config } from '../config';

const chatApi = axios.create({ baseURL: config.services.chat, timeout: 10000 });
const authApi = axios.create({ baseURL: config.services.auth, timeout: 10000 });

function getAuthHeaders(userId?: string) {
  return userId ? { 'x-user-id': userId } : {};
}

const userLoader = new DataLoader<string, any>(async (ids: readonly string[]) => {
  try {
    const { data } = await authApi.post('/users/batch', { ids }, { timeout: 5000 });
    const users = data?.data ?? data ?? [];
    const map = new Map(users.map((u: any) => [u.id, u]));
    return ids.map(id => map.get(id) ?? null);
  } catch {
    return ids.map(() => null);
  }
});

const userCache = new Map<string, { data: any; expiry: number }>();
const USER_CACHE_TTL = 300000;

async function getCachedUser(id: string): Promise<any> {
  const cached = userCache.get(id);
  if (cached && cached.expiry > Date.now()) return cached.data;
  const user = await userLoader.load(id);
  userCache.set(id, { data: user, expiry: Date.now() + USER_CACHE_TTL });
  return user;
}

function extractMessage(raw: any): any {
  return {
    messageId: raw.messageId ?? raw.id,
    conversationId: raw.conversationId,
    senderId: raw.senderId,
    senderName: raw.senderName ?? 'Người dùng',
    body: raw.body ?? raw.content ?? '',
    contentType: raw.contentType ?? 'TEXT',
    attachments: (raw.attachments || []).map((a: any) => ({
      key: a.key ?? '',
      url: a.url ?? '',
      type: a.type ?? 'document',
      name: a.name ?? 'file',
      size: a.size ?? 0,
      contentType: a.contentType ?? null,
      thumbnailUrl: a.thumbnailUrl ?? null,
    })),
    createdAt: typeof raw.createdAt === 'string' ? new Date(raw.createdAt).getTime() : Number(raw.createdAt),
    isDeleted: Boolean(raw.isDeleted),
    replyToMessageId: raw.replyToMessageId ?? raw.replyToId ?? null,
    replyTo: raw.replyTo ? {
      messageId: raw.replyTo.messageId,
      senderId: raw.replyTo.senderId,
      senderName: raw.replyTo.senderName ?? 'Người dùng',
      body: raw.replyTo.body ?? '',
      attachments: (raw.replyTo.attachments || []).map((a: any) => ({
        key: a.key ?? '', url: a.url ?? '', type: a.type ?? 'document',
        name: a.name ?? 'file', size: a.size ?? 0,
        contentType: a.contentType ?? null, thumbnailUrl: a.thumbnailUrl ?? null,
      })),
      isDeleted: Boolean(raw.replyTo.isDeleted),
    } : null,
    editedAt: raw.editedAt ? new Date(raw.editedAt).getTime() : null,
  };
}

export const resolvers = {
  Conversation: {
    members: async (parent: any, _: any, context: { userId: string }) => {
      if (!parent.members) return [];
      return Promise.all(
        parent.members.map(async (m: any) => {
          const user = await getCachedUser(m.userId);
          return { userId: m.userId, role: m.role, nickname: m.nickname, user };
        })
      );
    },
  },
  ConversationMember: {
    user: async (parent: any) => {
      const user = await getCachedUser(parent.userId);
      return user ? {
        id: user.id,
        username: user.username ?? user.id,
        displayName: user.displayName ?? user.username ?? user.id,
        avatarUrl: user.avatarUrl ?? null,
        email: user.email ?? null,
        bio: user.bio ?? null,
      } : null;
    },
  },
  Query: {
    conversations: async (_: any, args: { page?: number; limit?: number }, context: { userId: string }) => {
      const { data } = await chatApi.get('/conversations', {
        params: { page: args.page ?? 1, limit: args.limit ?? 20 },
        headers: getAuthHeaders(context.userId),
      });
      const items = data?.data ?? data ?? [];
      return items.map((c: any) => ({
        id: c.id,
        type: c.type,
        title: c.title,
        avatarUrl: c.avatarUrl,
        createdAt: new Date(c.createdAt).getTime(),
        unreadCount: c.unreadCount ?? 0,
        lastMessage: c.lastMessage ? extractMessage(c.lastMessage) : null,
        members: c.members ?? [],
      }));
    },

    conversation: async (_: any, args: { id: string }, context: { userId: string }) => {
      const { data } = await chatApi.get(`/conversations/${args.id}`, {
        headers: getAuthHeaders(context.userId),
      });
      const c = data?.data ?? data;
      return {
        id: c.id,
        type: c.type,
        title: c.title,
        avatarUrl: c.avatarUrl,
        createdAt: new Date(c.createdAt).getTime(),
        unreadCount: c.unreadCount ?? 0,
        lastMessage: c.lastMessage ? extractMessage(c.lastMessage) : null,
        members: c.members ?? [],
      };
    },

    messages: async (_: any, args: { conversationId: string; cursor?: string; limit?: number }, context: { userId: string }) => {
      const { data } = await chatApi.get(`/messages/${args.conversationId}`, {
        params: { cursor: args.cursor, limit: args.limit ?? 50 },
        headers: getAuthHeaders(context.userId),
      });
      const page = data?.data ?? data;
      return {
        items: (page.items || []).map(extractMessage),
        nextCursor: page.nextCursor ?? null,
        hasMore: Boolean(page.hasMore),
      };
    },

    messageDetail: async (_: any, args: { conversationId: string; createdAt: number; messageId: string }, context: { userId: string }) => {
      const { data } = await chatApi.get(`/messages/${args.conversationId}/${args.createdAt}/${args.messageId}`, {
        headers: getAuthHeaders(context.userId),
      });
      const raw = data?.data ?? data;
      return extractMessage(raw);
    },

    user: async (_: any, args: { id: string }) => {
      try {
        const u = await getCachedUser(args.id);
        if (!u) return null;
        return {
          id: u.id,
          username: u.username ?? u.id,
          displayName: u.displayName ?? u.username ?? u.id,
          avatarUrl: u.avatarUrl ?? null,
          email: u.email ?? null,
          bio: u.bio ?? null,
        };
      } catch {
        return null;
      }
    },

    searchUsers: async (_: any, args: { q: string; limit?: number }, context: { userId: string }) => {
      const { data } = await authApi.get('/users/search', {
        params: { q: args.q, limit: args.limit ?? 20, offset: 0 },
        headers: getAuthHeaders(context.userId),
      });
      const users = data?.data ?? [];
      return users.map((u: any) => ({
        id: u.id,
        username: u.username ?? u.id,
        displayName: u.displayName ?? u.username ?? u.id,
        avatarUrl: u.avatarUrl ?? null,
        email: u.email ?? null,
        bio: u.bio ?? null,
      }));
    },
  },

  Mutation: {
    sendMessage: async (_: any, args: { conversationId: string; content: string; contentType?: string; attachments?: any[]; replyToId?: string; clientMessageId?: string }, context: { userId: string }) => {
      const { data } = await chatApi.post(
        `/conversations/${args.conversationId}/messages`,
        {
          content: args.content,
          contentType: args.contentType ?? 'TEXT',
          attachments: args.attachments ?? [],
          reply_to_id: args.replyToId,
          client_message_id: args.clientMessageId,
        },
        { headers: getAuthHeaders(context.userId) }
      );
      const raw = data?.data ?? data;
      return extractMessage(raw);
    },
  },
};
