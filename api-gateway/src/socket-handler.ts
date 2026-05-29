import { Server as HTTPServer, Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config';
import axios from 'axios';
<<<<<<< HEAD
import * as presence from './redis';
=======
>>>>>>> origin/main

const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 20 });
const httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 20 });
let io: Server | null = null;

<<<<<<< HEAD
=======
// In-memory socket ID mapping (local to this Gateway instance)
const userSockets = new Map<string, Set<string>>();

const presenceApi = axios.create({
  baseURL: config.services.auth,
  timeout: 3000,
  headers: { 'x-internal-api-key': config.internalApiKey },
  validateStatus: () => true,
});

async function callPresence(path: string, userId: string) {
  try {
    await presenceApi.post(`/api/presence${path}`, { userId });
  } catch {}
}

>>>>>>> origin/main
export function setupSocketIO(httpServer: HTTPServer): Server {
  const srv = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
  });
  io = srv;

  srv.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const bearer = token.startsWith('Bearer ') ? token.slice(7) : token;
      const payload = jwt.verify(bearer, config.jwtSecret) as { sub: string };
      (socket as any).userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  srv.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId as string;

<<<<<<< HEAD
    presence.presenceAdd(userId, socket.id);
=======
    // Track socket in-memory + notify Auth Service
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);
    callPresence('/connect', userId);
>>>>>>> origin/main
    srv.emit('presence:online', { userId });

    socket.on('chat:join', (data: { conversation_id: string }) => {
      if (data?.conversation_id) {
        socket.join(`conversation:${data.conversation_id}`);
      }
    });

    socket.on('chat:send', async (data: {
      message_id: string;
      conversation_id: string;
      body: string;
      attachments?: any[];
      sent_at: number;
    }, ack?: (response: any) => void) => {
      try {
        const response = await axios({
          method: 'POST',
          url: `${config.services.chat}/conversations/${data.conversation_id}/messages`,
          data: {
            content: data.body,
            attachments: data.attachments ?? [],
            clientMessageId: data.message_id,
          },
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          httpAgent,
          httpsAgent,
          validateStatus: () => true,
        });

        const messageData = response.data;

        const newMsg = {
          ...messageData,
          conversationId: data.conversation_id,
          senderId: userId,
          messageId: messageData.id ?? data.message_id,
          clientMessageId: data.message_id,
          body: data.body,
          createdAt: messageData.createdAt ?? data.sent_at,
        };

        socket.broadcast.to(`conversation:${data.conversation_id}`).emit('chat:new', newMsg);

        if (ack) {
          ack({
            success: true,
            messageId: messageData.id ?? data.message_id,
            createdAt: messageData.createdAt ?? data.sent_at,
            data: messageData,
          });
        }
      } catch (error: any) {
        if (ack) {
          ack({ success: false, error: error?.message ?? 'Failed to send message' });
        }
      }
    });

    socket.on('chat:typing', (data: { conversation_id: string }) => {
      if (data?.conversation_id) {
        socket.broadcast.to(`conversation:${data.conversation_id}`).emit('chat:typing', {
          userId,
          conversationId: data.conversation_id,
        });
      }
    });

    socket.on('chat:stop_typing', (data: { conversation_id: string }) => {
      if (data?.conversation_id) {
        socket.broadcast.to(`conversation:${data.conversation_id}`).emit('chat:stop_typing', {
          userId,
          conversationId: data.conversation_id,
        });
      }
    });

    socket.on('presence:heartbeat', async () => {
<<<<<<< HEAD
      await presence.presenceHeartbeat(userId, socket.id);
    });

    socket.on('disconnect', async () => {
      await presence.presenceRemove(userId, socket.id);
=======
      callPresence('/heartbeat', userId);
    });

    socket.on('disconnect', async () => {
      // Remove socket from in-memory tracking
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          callPresence('/disconnect', userId);
        }
      }
>>>>>>> origin/main
      srv.emit('presence:offline', { userId });
    });

    socket.on('conversation:join', (data: { conversation_id: string }) => {
      if (data?.conversation_id) {
        socket.join(`conversation:${data.conversation_id}`);
      }
    });

    socket.on('conversation:leave', (data: { conversation_id: string }) => {
      if (data?.conversation_id) {
        socket.leave(`conversation:${data.conversation_id}`);
      }
    });

    socket.on('message:read', async (data: { conversation_id: string; message_id: string }) => {
      if (data?.conversation_id && data?.message_id) {
        try {
          await axios({
            method: 'POST',
            url: `${config.services.chat}/conversations/${data.conversation_id}/read`,
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': userId,
            },
            httpAgent,
            httpsAgent,
            validateStatus: () => true,
          });

          socket.broadcast.to(`conversation:${data.conversation_id}`).emit('message:read', {
            userId,
            conversationId: data.conversation_id,
            messageId: data.message_id,
            readAt: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Failed to mark message as read:', error);
        }
      }
    });
  });

  return srv;
}

export async function notifyConversation(conversationId: string, message: any) {
  if (io) {
    io.to(`conversation:${conversationId}`).emit('chat:new', message);
  }
}

export async function notifyNewConversation(conversation: any) {
  if (io && conversation?.memberIds) {
    for (const memberId of conversation.memberIds) {
<<<<<<< HEAD
      const socketIds = await presence.getConnectedSocketIds(memberId);
      socketIds.forEach((socketId) => {
        io?.to(socketId).emit('conversation:created', conversation);
      });
=======
      const socketIds = userSockets.get(memberId);
      if (socketIds) {
        socketIds.forEach((socketId) => {
          io?.to(socketId).emit('conversation:created', conversation);
        });
      }
>>>>>>> origin/main
    }
  }
}

export async function notifyMessageRead(conversationId: string, userId: string, messageId: string) {
  if (io) {
    io.to(`conversation:${conversationId}`).emit('message:read', {
      userId,
      conversationId,
      messageId,
      readAt: new Date().toISOString(),
    });
  }
}

export async function getOnlineUserIds(): Promise<string[]> {
<<<<<<< HEAD
  return presence.getOnlineUserIds();
}

export async function isUserOnline(userId: string): Promise<boolean> {
  return presence.isUserOnline(userId);
=======
  try {
    const res = await presenceApi.get('/api/presence/online');
    return res.data?.data ?? [];
  } catch {
    return [];
  }
}

export async function isUserOnline(userId: string): Promise<boolean> {
  try {
    const res = await presenceApi.get(`/api/presence/online`, { params: { userId } });
    return res.data?.data === true;
  } catch {
    return false;
  }
>>>>>>> origin/main
}
