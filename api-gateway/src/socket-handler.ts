import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config';
import axios from 'axios';

const onlineUsers = new Map<string, Set<string>>();
let io: Server | null = null;

function getConnectedSocketIds(userId: string): string[] {
  return Array.from(onlineUsers.get(userId) ?? []);
}

function addOnlineUser(userId: string, socketId: string) {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId)!.add(socketId);
}

function removeOnlineUser(userId: string, socketId: string) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
  }
}

function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId) && (onlineUsers.get(userId)?.size ?? 0) > 0;
}

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

    addOnlineUser(userId, socket.id);
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

    socket.on('presence:heartbeat', () => {
      addOnlineUser(userId, socket.id);
    });

    socket.on('disconnect', () => {
      removeOnlineUser(userId, socket.id);
      srv.emit('presence:offline', { userId });
    });

    // Handle conversation:created event (from RabbitMQ or internal)
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

    // Handle message read receipts
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
            validateStatus: () => true,
          });
          
          // Broadcast to conversation members
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

export function notifyConversation(conversationId: string, message: any) {
  if (io) {
    io.to(`conversation:${conversationId}`).emit('chat:new', message);
  }
}

export function notifyNewConversation(conversation: any) {
  if (io && conversation?.memberIds) {
    // Notify all members of the new conversation
    conversation.memberIds.forEach((memberId: string) => {
      const socketIds = getConnectedSocketIds(memberId);
      socketIds.forEach((socketId) => {
        io?.to(socketId).emit('conversation:created', conversation);
      });
    });
  }
}

export function notifyMessageRead(conversationId: string, userId: string, messageId: string) {
  if (io) {
    io.to(`conversation:${conversationId}`).emit('message:read', {
      userId,
      conversationId,
      messageId,
      readAt: new Date().toISOString(),
    });
  }
}

export function getOnlineUserIds(): string[] {
  return Array.from(onlineUsers.keys());
}

export { isUserOnline };
