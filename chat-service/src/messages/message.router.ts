import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, AuthReq, validate } from '../middleware';
import * as messageService from './message.service';

const router = Router();

router.get(
  '/:conversationId',
  authenticate,
  [
    param('conversationId').isUUID(),
    query('cursor').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const data = await messageService.listMessages(
        req.userId!,
        req.params.conversationId,
        req.query.cursor as string | undefined,
        limit
      );
      res.json({ success: true, data });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

router.patch(
  '/:conversationId/:createdAt/:messageId',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('createdAt').isInt(),
    param('messageId').isUUID(),
    body('content').isString().notEmpty(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const data = await messageService.editMessage(
        req.userId!,
        req.params.conversationId,
        Number(req.params.createdAt),
        req.params.messageId,
        req.body.content
      );
      res.json({ success: true, data });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

router.get(
  '/:conversationId/:createdAt/:messageId',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('createdAt').isInt(),
    param('messageId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const message = await messageService.getMessageDetail(
        req.userId!,
        req.params.conversationId,
        Number(req.params.createdAt),
        req.params.messageId
      );
      res.json({ success: true, data: message });
    } catch (e: any) {
      res.status(404).json({ message: e.message });
    }
  }
);

router.get(
  '/:conversationId/search',
  authenticate,
  [
    param('conversationId').isUUID(),
    query('q').optional().isString(),
    query('senderId').optional().isUUID(),
    query('from').optional().isInt(),
    query('to').optional().isInt(),
    query('fileType').optional().isIn(['images', 'video', 'files']),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const data = await messageService.searchMessages(
        req.userId!,
        req.params.conversationId,
        req.query.q as string | undefined,
        req.query.senderId as string | undefined,
        req.query.from ? Number(req.query.from) : undefined,
        req.query.to ? Number(req.query.to) : undefined,
        req.query.fileType as string | undefined
      );
      res.json({ success: true, data });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

router.post(
  '/forward',
  authenticate,
  [
    body('forward_id').isUUID(),
    body('source_message_id').isUUID(),
    body('targets').isArray({ min: 1, max: 20 }),
    body('targets.*.message_id').optional().isUUID(),
    body('targets.*.conversation_id').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const data = await messageService.forwardMessage(
        req.userId!,
        req.body.forward_id,
        req.body.source_message_id,
        req.body.targets
      );
      res.status(201).json({ success: true, data });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

router.post(
  '/:conversationId/:createdAt/:messageId/pin',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('createdAt').isInt(),
    param('messageId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const data = await messageService.pinMessage(
        req.userId!,
        req.params.conversationId,
        Number(req.params.createdAt),
        req.params.messageId
      );
      res.json({ success: true, data });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

router.delete(
  '/:conversationId/:createdAt/:messageId/pin',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('createdAt').isInt(),
    param('messageId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const data = await messageService.unpinMessage(
        req.userId!,
        req.params.conversationId,
        Number(req.params.createdAt),
        req.params.messageId
      );
      res.json({ success: true, data });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

router.get(
  '/:conversationId/pins',
  authenticate,
  [param('conversationId').isUUID(), query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const data = await messageService.listPinnedMessages(
        req.userId!,
        req.params.conversationId,
        req.query.limit ? Number(req.query.limit) : 20
      );
      res.json({ success: true, data });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

router.get(
  '/:messageId/reactions',
  authenticate,
  [param('messageId').isUUID()],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const data = await messageService.getMessageReactions(req.userId!, req.params.messageId);
      res.json({ success: true, data });
    } catch (e: any) {
      res.status(404).json({ message: e.message });
    }
  }
);

router.get(
  '/v1/messages/lookup/:messageId',
  [param('messageId').isUUID()],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const data = await messageService.lookupMessageById(req.params.messageId);
      if (!data) {
        res.status(404).json({ message: 'Message not found' });
        return;
      }
      res.json({ success: true, data });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

router.delete(
  '/:conversationId/:createdAt/:messageId',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('createdAt').isInt(),
    param('messageId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const data = await messageService.deleteMessage(
        req.userId!,
        req.params.conversationId,
        Number(req.params.createdAt),
        req.params.messageId
      );
      res.json({ success: true, data });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

export default router;
