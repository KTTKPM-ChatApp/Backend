import http from 'http';
import url from 'url';
import jwt from 'jsonwebtoken';
import { SfuManager } from '../sfu/SfuManager';
import { RoomManager } from '../sfu/Room';
import { config } from '../config';

interface WsClient {
  ws: any;
  peerId: string;
  roomId: string;
  userId: string;
}

const clients: Map<string, WsClient> = new Map();

export function setupWsRoutes(server: http.Server, sfuManager: SfuManager, roomManager: RoomManager): void {
  const WebSocket = require('ws');
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws: any, req: http.IncomingMessage) => {
    const params = url.parse(req.url || '', true).query;
    const token = params.token as string;
    const roomId = params.roomId as string;
    const peerId = params.peerId as string;

    if (!token || !roomId || !peerId) {
      ws.close(4001, 'Missing token, roomId, or peerId');
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    const room = sfuManager.getRoom(roomId);
    if (!room) {
      ws.close(4004, 'Room not found');
      return;
    }

    const userId = decoded.sub || decoded.id || decoded.userId;
    const clientKey = `${roomId}:${peerId}`;
    clients.set(clientKey, { ws, peerId, roomId, userId });

    room.peerIds.add(peerId);

    broadcastToRoom(roomId, {
      type: 'peer-joined',
      peerId,
      userId,
    }, peerId);

    console.log(`[SFU-WS] Peer ${peerId} joined room ${roomId}`);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'active-speaker': {
            broadcastToRoom(roomId, {
              type: 'active-speaker',
              peerId: message.peerId,
            });
            break;
          }

          case 'new-consumer': {
            broadcastToRoom(roomId, {
              type: 'new-consumer',
              producerId: message.producerId,
              peerId: message.peerId,
              kind: message.kind,
            }, peerId);
            break;
          }

          default:
            console.warn(`[SFU-WS] Unknown message type: ${message.type}`);
        }
      } catch {
        console.warn('[SFU-WS] Invalid message');
      }
    });

    ws.on('close', () => {
      clients.delete(clientKey);

      roomManager.removeProducersByPeerId(room, peerId);
      roomManager.removeConsumersByPeerId(room, peerId);
      room.peerIds.delete(peerId);

      broadcastToRoom(roomId, {
        type: 'peer-left',
        peerId,
      });

      if (room.peerIds.size === 0) {
        const idleTimeout = 30000;
        setTimeout(async () => {
          if (room.peerIds.size === 0) {
            await sfuManager.closeRoom(roomId);
          }
        }, idleTimeout);
      }

      console.log(`[SFU-WS] Peer ${peerId} left room ${roomId}`);
    });

    ws.on('error', (err: Error) => {
      console.error(`[SFU-WS] Error for peer ${peerId}:`, err.message);
    });

    ws.send(JSON.stringify({
      type: 'room-joined',
      roomId,
      peerId,
      peers: Array.from(room.peerIds).filter((p) => p !== peerId),
    }));
  });

  function broadcastToRoom(roomId: string, message: any, excludePeerId?: string) {
    for (const [key, client] of clients) {
      if (
        client.roomId === roomId &&
        client.ws.readyState === WebSocket.OPEN &&
        client.peerId !== excludePeerId
      ) {
        client.ws.send(JSON.stringify(message));
      }
    }
  }
}
