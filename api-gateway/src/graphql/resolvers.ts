import axios from 'axios';
import { config } from '../config';

const chatApi = axios.create({ baseURL: config.services.chat, timeout: 10000 });
const authApi = axios.create({ baseURL: config.services.auth, timeout: 10000 });

function getAuthHeaders(userId?: string) {
  return userId ? { 'x-user-id': userId } : {};
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
        const { data } = await authApi.get(`/users/${args.id}`);
        const u = data?.data ?? data;
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
    sendMessage: async (_: any, args: { conversationId: string; content: string; contentType?: string; attachments?: any[]; replyToId?: string }, context: { userId: string }) => {
      const { data } = await chatApi.post(
        `/conversations/${args.conversationId}/messages`,
        {
          content: args.content,
          contentType: args.contentType ?? 'TEXT',
          attachments: args.attachments ?? [],
          reply_to_id: args.replyToId,
        },
        { headers: getAuthHeaders(context.userId) }
      );
      const raw = data?.data ?? data;
      return extractMessage(raw);
    },
  },
};
