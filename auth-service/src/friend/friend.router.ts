import { Router, Response } from 'express';
import { body, param } from 'express-validator';
import { authenticate, validate, AuthReq } from '../middleware';
import * as friendService from './friend.service';

const router = Router();

/** GET /friends — danh sách bạn bè */
router.get('/', authenticate, async (req: AuthReq, res: Response) => {
  try {
    const friends = await friendService.getFriends(req.userId!);
    res.json({ success: true, data: friends });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message });
  }
});

/** GET /friends/requests/pending — lời mời đang chờ (incoming) */
router.get('/requests/pending', authenticate, async (req: AuthReq, res: Response) => {
  try {
    const requests = await friendService.getPendingRequests(req.userId!);
    res.json({ success: true, data: requests });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message });
  }
});

/** GET /friends/requests/sent — lời mời đã gửi (outgoing) */
router.get('/requests/sent', authenticate, async (req: AuthReq, res: Response) => {
  try {
    const requests = await friendService.getSentRequests(req.userId!);
    res.json({ success: true, data: requests });
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message });
  }
});

/** POST /friends/requests — gửi lời mời kết bạn */
router.post('/requests',
  authenticate,
  [body('receiverId').isUUID(), body('message').optional().isString()],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const result = await friendService.sendRequest(req.userId!, req.body.receiverId, req.body.message);
      res.status(201).json({ success: true, data: result });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message });
    }
  }
);

/** PUT /friends/requests/:requestId — chấp nhận / từ chối */
router.put('/requests/:requestId',
  authenticate,
  [param('requestId').isUUID(), body('action').isIn(['accepted', 'rejected'])],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const result = await friendService.respondToRequest(req.params.requestId, req.userId!, req.body.action);
      res.json({ success: true, data: result });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message });
    }
  }
);

/** DELETE /friends/requests/:requestId — hủy lời mời */
router.delete('/requests/:requestId',
  authenticate,
  [param('requestId').isUUID()],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const result = await friendService.cancelRequest(req.params.requestId, req.userId!);
      res.json({ success: true, data: result });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message });
    }
  }
);

/** DELETE /friends/:friendId — xóa bạn bè */
router.delete('/:friendId',
  authenticate,
  [param('friendId').isUUID()],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const result = await friendService.removeFriend(req.userId!, req.params.friendId);
      res.json({ success: true, data: result });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message });
    }
  }
);

/** POST /friends/:userId/block — chặn người dùng */
router.post('/:userId/block',
  authenticate,
  [param('userId').isUUID(), body('reason').optional().isString()],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const result = await friendService.blockUser(req.userId!, req.params.userId, req.body.reason);
      res.json({ success: true, data: result });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message });
    }
  }
);

/** DELETE /friends/:userId/block — bỏ chặn */
router.delete('/:userId/block',
  authenticate,
  [param('userId').isUUID()],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const result = await friendService.unblockUser(req.userId!, req.params.userId);
      res.json({ success: true, data: result });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message });
    }
  }
);

export default router;
