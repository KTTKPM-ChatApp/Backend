import { Router, Response } from 'express';
import { body, query } from 'express-validator';
import { authenticate, validate, AuthReq } from '../middleware';
import * as chatService from './chat.service';

const router = Router();

/**
 * POST /conversations
 * @header x-user-id string
 * @body type string (DIRECT | GROUP)
 * @body participantIds string[]
 * @body title string (optional, required for GROUP)
 */
router.post('/',
  authenticate,
  [
    body('type').isIn(['DIRECT', 'GROUP']),
    body('participantIds').isArray({ min: 1 }),
    body('participantIds.*').isString(),
    body('title').optional().isString(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const { type, participantIds, title } = req.body;
      const conversation = await chatService.createConversation(
        req.userId!,
        type,
        participantIds,
        title
      );
      res.status(201).json(conversation);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

/**
 * GET /conversations
 * @header x-user-id string
 * @query limit number (default 20, max 100)
 * @query offset number (default 0)
 */
router.get('/',
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const conversations = await chatService.listConversations(req.userId!, limit, offset);
    res.json({ conversations });
  }
);

/**
 * GET /conversations/:conversationId/messages
 * @header x-user-id string
 * @param conversationId string
 * @query limit number (default 50, max 100)
 * @query before string (ISO date, optional)
 */
router.get('/:conversationId/messages',
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('before').optional().isISO8601(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const before = req.query.before as string | undefined;
      const messages = await chatService.getConversationMessages(
        req.userId!,
        req.params.conversationId,
        limit,
        before
      );
      res.json({ messages });
    } catch (e: any) {
      res.status(404).json({ message: e.message });
    }
  }
);

/**
 * POST /conversations/:conversationId/messages
 * @header x-user-id string
 * @param conversationId string
 * @body content string
 * @body contentType string (default TEXT)
 */
router.post('/:conversationId/messages',
  authenticate,
  [
    body('content').isString().notEmpty(),
    body('contentType').optional().isString(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const { content, contentType } = req.body;
      const message = await chatService.sendMessage(
        req.userId!,
        req.params.conversationId,
        content,
        contentType
      );
      res.status(201).json(message);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

export default router;
