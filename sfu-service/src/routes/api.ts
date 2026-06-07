import { Router, Request, Response } from 'express';
import { SfuManager } from '../sfu/SfuManager';
import { RoomManager } from '../sfu/Room';

export function setupApiRoutes(sfuManager: SfuManager, roomManager: RoomManager): Router {
  const router = Router();

  router.get('/rooms', (_req: Request, res: Response) => {
    res.json(sfuManager.getStats());
  });

  router.post('/rooms', async (req: Request, res: Response) => {
    try {
      const { roomId, conversationId } = req.body;

      if (!roomId || !conversationId) {
        return res.status(400).json({ error: 'roomId and conversationId required' });
      }

      const room = await sfuManager.createRoom(roomId, conversationId);
      const routerRtpCapabilities = room.router.rtpCapabilities;

      return res.json({
        roomId: room.id,
        conversationId: room.conversationId,
        routerRtpCapabilities,
      });
    } catch (err: any) {
      console.error('[SFU] Create room error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/rooms/:roomId', (req: Request, res: Response) => {
    const room = sfuManager.getRoom(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    res.json({
      roomId: room.id,
      conversationId: room.conversationId,
      peerCount: room.peerIds.size,
      producerCount: room.producers.size,
      consumerCount: room.consumers.size,
      transportCount: room.transports.size,
      creationTime: room.creationTime,
    });
  });

  router.delete('/rooms/:roomId', async (req: Request, res: Response) => {
    try {
      await sfuManager.closeRoom(req.params.roomId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/rooms/:roomId/create-transport', async (req: Request, res: Response) => {
    try {
      const { peerId, direction } = req.body;
      const room = sfuManager.getRoom(req.params.roomId);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const transport = await roomManager.createWebRtcTransport(room, direction);
      room.peerIds.add(peerId);

      return res.json({
        transportId: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (err: any) {
      console.error('[SFU] Create transport error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/rooms/:roomId/connect-transport', async (req: Request, res: Response) => {
    try {
      const { transportId, dtlsParameters } = req.body;
      const room = sfuManager.getRoom(req.params.roomId);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      await roomManager.connectTransport(room, transportId, dtlsParameters);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/rooms/:roomId/produce', async (req: Request, res: Response) => {
    try {
      const { transportId, kind, rtpParameters, appData } = req.body;
      const room = sfuManager.getRoom(req.params.roomId);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const producer = await roomManager.produce(room, transportId, kind, rtpParameters, appData);
      return res.json({ producerId: producer.id });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/rooms/:roomId/consume', async (req: Request, res: Response) => {
    try {
      const { transportId, producerId, rtpCapabilities } = req.body;
      const room = sfuManager.getRoom(req.params.roomId);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const consumer = await roomManager.consume(room, transportId, producerId, rtpCapabilities);
      if (!consumer) {
        return res.status(400).json({ error: 'Cannot consume' });
      }

      return res.json({
        consumerId: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/rooms/:roomId/resume-consumer', async (req: Request, res: Response) => {
    try {
      const { consumerId } = req.body;
      const room = sfuManager.getRoom(req.params.roomId);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const consumer = room.consumers.get(consumerId);
      if (!consumer) return res.status(404).json({ error: 'Consumer not found' });

      await consumer.resume();
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/rooms/:roomId/set-preferred-layers', async (req: Request, res: Response) => {
    try {
      const { consumerId, spatialLayer, temporalLayer } = req.body;
      const room = sfuManager.getRoom(req.params.roomId);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      await roomManager.setConsumerPreferredLayers(room, consumerId, spatialLayer, temporalLayer);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/rooms/:roomId/request-keyframe', async (req: Request, res: Response) => {
    try {
      const { consumerId } = req.body;
      const room = sfuManager.getRoom(req.params.roomId);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      await roomManager.requestConsumerKeyFrame(room, consumerId);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/rooms/:roomId/close-producer', async (req: Request, res: Response) => {
    try {
      const { producerId } = req.body;
      const room = sfuManager.getRoom(req.params.roomId);
      if (!room) return res.status(404).json({ error: 'Room not found' });

      roomManager.removeProducer(room, producerId);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
