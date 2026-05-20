import { Router, Response } from 'express';
import { body, query } from 'express-validator';
import { authenticate, validate, AuthReq } from '../middleware';
import * as chatService from './chat.service';
import conversationRouter from '../conversations/conversation.router';
import multer from 'multer';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

const router = Router();
// Mount full conversation feature routes so api-gateway endpoints are served from this router too.
router.use('/', conversationRouter);

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
    res.json({
      success: true,
      data: conversations,
      meta: {
        total: conversations.length,
        page: Math.floor(offset / limit) + 1,
        limit: limit,
        totalPages: Math.ceil(conversations.length / limit),
        hasNext: conversations.length >= limit,
        hasPrev: offset > 0
      },
      timestamp: new Date().toISOString()
    });
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
      res.json({
        success: true,
        data: messages,
        meta: {
          total: messages.length,
          page: 1,
          limit: limit,
          totalPages: Math.ceil(messages.length / limit),
          hasNext: messages.length >= limit,
          hasPrev: false
        },
        timestamp: new Date().toISOString()
      });
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
    body('attachments').optional().isArray(),
    body('reply_to_id').optional({ nullable: true }).isString(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const { content, contentType, attachments, reply_to_id } = req.body;
      const message = await chatService.sendMessage(
        req.userId!,
        req.params.conversationId,
        content,
        contentType,
        attachments || [],
        reply_to_id || null
      );
      res.status(201).json(message);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

/**
 * POST /media/upload
 * @header x-user-id string
 * @body file (multipart/form-data)
 */
router.post('/media/upload',
  authenticate,
  upload.single('file'),
  (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // For now, return mock response with actual file info
      const uploadResult = {
        key: `upload-${Date.now()}-${req.file.originalname}`,
        url: `http://localhost:3003/uploads/upload-${Date.now()}-${req.file.originalname}`,
        visibility: "public",
        thumbnailKey: null,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      };
      
      res.status(200).json({
        success: true,
        data: uploadResult,
        message: 'File uploaded successfully'
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Upload failed' 
      });
    }
  }
);

export default router;
