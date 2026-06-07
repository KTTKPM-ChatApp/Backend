import { Router, WebRtcTransport, Producer, Consumer, DataProducer, DataConsumer, RtpCapabilities } from 'mediasoup/node/lib/types';

export interface SfuRoom {
  id: string;
  conversationId: string;
  router: Router;
  transports: Map<string, WebRtcTransport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
  dataProducers: Map<string, DataProducer>;
  dataConsumers: Map<string, DataConsumer>;
  peerIds: Set<string>;
  creationTime: number;
}

export interface CreateRoomRequest {
  conversationId: string;
}

export interface CreateTransportRequest {
  roomId: string;
  peerId: string;
  direction: 'send' | 'recv';
}

export interface CreateTransportResponse {
  transportId: string;
  iceParameters: any;
  iceCandidates: any[];
  dtlsParameters: any;
  sctpParameters?: any;
}

export interface ConnectTransportRequest {
  roomId: string;
  transportId: string;
  dtlsParameters: any;
}

export interface ProduceRequest {
  roomId: string;
  transportId: string;
  kind: 'audio' | 'video';
  rtpParameters: any;
  appData?: Record<string, any>;
}

export interface ProduceResponse {
  producerId: string;
}

export interface ConsumeRequest {
  roomId: string;
  transportId: string;
  producerId: string;
  rtpCapabilities: RtpCapabilities;
  appData?: Record<string, any>;
}

export interface ConsumeResponse {
  consumerId: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: any;
  type: string;
}

export interface PeerJoined {
  type: 'peer-joined';
  peerId: string;
}

export interface PeerLeft {
  type: 'peer-left';
  peerId: string;
}

export interface NewConsumer {
  type: 'new-consumer';
  producerId: string;
  peerId: string;
  kind: 'audio' | 'video';
}

export interface ActiveSpeaker {
  type: 'active-speaker';
  peerId: string | null;
}

export type SfuEvent = PeerJoined | PeerLeft | NewConsumer | ActiveSpeaker;

export interface MediaStats {
  producerId: string;
  peerId: string;
  kind: string;
  bitrate: number;
  packetLoss: number;
  jitter: number;
  resolution?: { width: number; height: number };
  frameRate?: number;
}
