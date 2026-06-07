import * as mediasoup from 'mediasoup';
import { Worker, Router } from 'mediasoup/node/lib/types';
import { SfuRoom } from '../types';
import { config } from '../config';

export class SfuManager {
  private workers: Worker[] = [];
  private rooms: Map<string, SfuRoom> = new Map();
  private nextWorkerIndex = 0;

  async initialize(): Promise<void> {
    const numWorkers = Math.max(1, require('os').cpus().length - 1);
    console.log(`[SFU] Initializing ${numWorkers} mediasoup workers`);

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: config.worker.logLevel,
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        rtcMinPort: config.mediaPorts.min,
        rtcMaxPort: config.mediaPorts.max,
      });

      worker.on('died', () => {
        console.error(`[SFU] Worker ${i} died, restarting...`);
        this.workers.splice(this.workers.indexOf(worker), 1);
      });

      this.workers.push(worker);
      console.log(`[SFU] Worker ${i} created (pid: ${worker.pid})`);
    }
  }

  private getNextWorker(): Worker {
    const worker = this.workers[this.nextWorkerIndex % this.workers.length];
    this.nextWorkerIndex++;
    return worker;
  }

  async createRoom(roomId: string, conversationId: string): Promise<SfuRoom> {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const worker = this.getNextWorker();
    const router = await worker.createRouter({ mediaCodecs: config.router.mediaCodecs });

    const room: SfuRoom = {
      id: roomId,
      conversationId,
      router,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      dataProducers: new Map(),
      dataConsumers: new Map(),
      peerIds: new Set(),
      creationTime: Date.now(),
    };

    this.rooms.set(roomId, room);
    console.log(`[SFU] Room ${roomId} created (conversation: ${conversationId})`);
    return room;
  }

  getRoom(roomId: string): SfuRoom | undefined {
    return this.rooms.get(roomId);
  }

  async closeRoom(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const transport of room.transports.values()) {
      transport.close();
    }
    for (const producer of room.producers.values()) {
      producer.close();
    }
    for (const consumer of room.consumers.values()) {
      consumer.close();
    }
    room.router.close();
    this.rooms.delete(roomId);
    console.log(`[SFU] Room ${roomId} closed`);
  }

  getRoomByConversation(conversationId: string): SfuRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.conversationId === conversationId) return room;
    }
    return undefined;
  }

  getStats(): { rooms: number; workers: number; peers: number; producers: number; consumers: number } {
    let peers = 0;
    let producers = 0;
    let consumers = 0;

    for (const room of this.rooms.values()) {
      peers += room.peerIds.size;
      producers += room.producers.size;
      consumers += room.consumers.size;
    }

    return {
      rooms: this.rooms.size,
      workers: this.workers.length,
      peers,
      producers,
      consumers,
    };
  }
}
