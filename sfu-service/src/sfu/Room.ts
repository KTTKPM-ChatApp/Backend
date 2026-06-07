import { WebRtcTransport, Producer, Consumer, RtpCapabilities, DtlsParameters } from 'mediasoup/node/lib/types';
import { SfuRoom } from '../types';
import { config } from '../config';

export class RoomManager {
  async createWebRtcTransport(room: SfuRoom, direction: 'send' | 'recv'): Promise<WebRtcTransport> {
    const transport = await room.router.createWebRtcTransport({
      listenIps: config.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: config.webRtcTransport.initialAvailableOutgoingBitrate,
      maxSendMessageSize: config.webRtcTransport.maxSendMessageSize,
      appData: { direction },
    });

    if (direction === 'recv') {
      transport.setMaxIncomingBitrate(config.webRtcTransport.maxIncomingBitrate);
    }

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        console.log(`[SFU] Transport ${transport.id} DTLS closed`);
      }
    });

    transport.on('icestatechange', (iceState) => {
      if (iceState === 'disconnected' || iceState === 'closed') {
        console.log(`[SFU] Transport ${transport.id} ICE ${iceState}`);
      }
    });

    room.transports.set(transport.id, transport);
    console.log(`[SFU] ${direction} transport ${transport.id} created in room ${room.id}`);
    return transport;
  }

  async connectTransport(room: SfuRoom, transportId: string, dtlsParameters: DtlsParameters): Promise<void> {
    const transport = room.transports.get(transportId);
    if (!transport) throw new Error(`Transport ${transportId} not found`);
    await transport.connect({ dtlsParameters });
    console.log(`[SFU] Transport ${transportId} connected`);
  }

  async produce(room: SfuRoom, transportId: string, kind: 'audio' | 'video', rtpParameters: any, appData?: Record<string, any>): Promise<Producer> {
    const transport = room.transports.get(transportId);
    if (!transport) throw new Error(`Transport ${transportId} not found`);

    const producer = await transport.produce({
      kind,
      rtpParameters,
      appData: { ...appData, transportId },
    });

    producer.on('transportclose', () => {
      console.log(`[SFU] Producer ${producer.id} transport closed`);
      room.producers.delete(producer.id);
    });

    room.producers.set(producer.id, producer);
    console.log(`[SFU] Producer ${producer.id} (${kind}) created in room ${room.id}`);
    return producer;
  }

  async consume(
    room: SfuRoom,
    transportId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities,
  ): Promise<Consumer | null> {
    const transport = room.transports.get(transportId);
    if (!transport) throw new Error(`Transport ${transportId} not found`);

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      console.warn(`[SFU] Cannot consume producer ${producerId} from transport ${transportId}`);
      return null;
    }

    const producer = room.producers.get(producerId);
    if (!producer) throw new Error(`Producer ${producerId} not found`);

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
      preferredLayers: producer.kind === 'video' ? { spatialLayer: 0, temporalLayer: 0 } : undefined,
    });

    consumer.on('transportclose', () => {
      console.log(`[SFU] Consumer ${consumer.id} transport closed`);
      room.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      console.log(`[SFU] Consumer ${consumer.id} producer closed`);
      room.consumers.delete(consumer.id);
    });

    room.consumers.set(consumer.id, consumer);
    console.log(`[SFU] Consumer ${consumer.id} (${producer.kind}) created in room ${room.id}`);
    return consumer;
  }

  async setConsumerPreferredLayers(room: SfuRoom, consumerId: string, spatialLayer: number, temporalLayer: number): Promise<void> {
    const consumer = room.consumers.get(consumerId);
    if (!consumer) throw new Error(`Consumer ${consumerId} not found`);
    await consumer.setPreferredLayers({ spatialLayer, temporalLayer });
  }

  async requestConsumerKeyFrame(room: SfuRoom, consumerId: string): Promise<void> {
    const consumer = room.consumers.get(consumerId);
    if (!consumer) throw new Error(`Consumer ${consumerId} not found`);
    await consumer.requestKeyFrame();
  }

  getProducerByPeerId(room: SfuRoom, peerId: string, kind: 'audio' | 'video'): Producer | undefined {
    for (const producer of room.producers.values()) {
      if (producer.appData.peerId === peerId && producer.kind === kind) {
        return producer;
      }
    }
    return undefined;
  }

  getConsumersByProducerId(room: SfuRoom, producerId: string): Consumer[] {
    const consumers: Consumer[] = [];
    for (const consumer of room.consumers.values()) {
      if (consumer.producerId === producerId) {
        consumers.push(consumer);
      }
    }
    return consumers;
  }

  removeProducer(room: SfuRoom, producerId: string): void {
    const producer = room.producers.get(producerId);
    if (producer) {
      producer.close();
      room.producers.delete(producerId);
    }
  }

  removeConsumersByPeerId(room: SfuRoom, peerId: string): void {
    const toRemove: string[] = [];
    for (const [consumerId, consumer] of room.consumers) {
      if (consumer.appData.peerId === peerId) {
        toRemove.push(consumerId);
      }
    }
    for (const consumerId of toRemove) {
      const consumer = room.consumers.get(consumerId);
      if (consumer) {
        consumer.close();
        room.consumers.delete(consumerId);
      }
    }
  }

  removeProducersByPeerId(room: SfuRoom, peerId: string): void {
    const toRemove: string[] = [];
    for (const [producerId, producer] of room.producers) {
      if (producer.appData.peerId === peerId) {
        toRemove.push(producerId);
      }
    }
    for (const producerId of toRemove) {
      this.removeProducer(room, producerId);
    }
  }
}
