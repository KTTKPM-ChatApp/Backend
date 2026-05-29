import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { validate, authenticate, AuthReq } from '../middleware';
import * as chatbotService from './chatbot.service';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List conversations
router.get('/conversations', async (req: AuthReq, res: Response) => {
  try {
    const conversations = await chatbotService.listConversations(req.userId!);
    res.json({ success: true, data: conversations });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// Create conversation
router.post(
  '/conversations',
  [body('title').optional().trim().isLength({ max: 255 })],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const conv = await chatbotService.createConversation(req.userId!, req.body.title);
      res.status(201).json({ success: true, data: conv });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  }
);

// Get conversation
router.get('/conversations/:conversationId', async (req: AuthReq, res: Response) => {
  try {
    const conv = await chatbotService.getConversation(req.userId!, req.params.conversationId);
    res.json({ success: true, data: conv });
  } catch (e: any) {
    res.status(404).json({ message: e.message });
  }
});

// Delete conversation
router.delete('/conversations/:conversationId', async (req: AuthReq, res: Response) => {
  try {
    const result = await chatbotService.deleteConversation(req.userId!, req.params.conversationId);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(404).json({ message: e.message });
  }
});

// List messages in conversation
router.get('/conversations/:conversationId/messages', async (req: AuthReq, res: Response) => {
  try {
    const messages = await chatbotService.listMessages(req.userId!, req.params.conversationId);
    res.json({ success: true, data: messages });
  } catch (e: any) {
    res.status(404).json({ message: e.message });
  }
});

// Send message and get AI response
router.post(
  '/conversations/:conversationId/messages',
  [body('content').trim().notEmpty().withMessage('Message content is required')],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const result = await chatbotService.sendMessage(
        req.userId!,
        req.params.conversationId,
        req.body.content
      );
      res.json({ success: true, data: result });
    } catch (e: any) {
      res.status(404).json({ message: e.message });
    }
  }
);

export default router;
