import { Router, Response } from 'express';
import { body, query, param } from 'express-validator';
import { authenticate, validate, AuthReq } from '../middleware';
import * as conversationService from './conversation.service';

const router = Router();

// 1. Quản lý Conversation cơ bản

// 1.1 Lấy danh sách conversations
router.get('/',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const result = await conversationService.listConversations(req.userId!, page, limit);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

// 1.2 Lấy conversation theo ID
router.get('/:conversationId',
  authenticate,
  [
    param('conversationId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const conversation = await conversationService.getConversationById(
        req.userId!,
        req.params.conversationId
      );
      res.json(conversation);
    } catch (e: any) {
      res.status(404).json({ message: e.message });
    }
  }
);

// 1.3 Tạo conversation nhóm
router.post('/group',
  authenticate,
  [
    body('name').isString().notEmpty().isLength({ max: 255 }),
    body('memberIds').isArray({ min: 1, max: 100 }),
    body('memberIds.*').isUUID(),
    body('avatarUrl').optional().isURL(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const { name, memberIds, avatarUrl } = req.body;
      const conversation = await conversationService.createGroupConversation(
        req.userId!,
        name,
        memberIds,
        avatarUrl
      );
      res.status(201).json(conversation);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

// 1.4 Tạo conversation trực tiếp
router.post('/direct',
  authenticate,
  [
    body('participantId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const conversation = await conversationService.createDirectConversation(
        req.userId!,
        req.body.participantId
      );
      res.status(201).json(conversation);
    } catch (e: any) {
      console.error('[createDirectConversation] Error:', e);
      res.status(400).json({ message: e.message, stack: e.stack });
    }
  }
);

// 1.5 Cập nhật conversation
router.patch('/:conversationId',
  authenticate,
  [
    param('conversationId').isUUID(),
    body('name').optional().isString().isLength({ max: 255 }),
    body('avatarUrl').optional().isURL(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const { name, avatarUrl } = req.body;
      const conversation = await conversationService.updateConversation(
        req.userId!,
        req.params.conversationId,
        name,
        avatarUrl
      );
      res.json(conversation);
    } catch (e: any) {
      res.status(403).json({ message: e.message });
    }
  }
);

// 2. Quản lý Thành viên

// 2.1 Thêm thành viên
router.post('/:conversationId/members',
  authenticate,
  [
    param('conversationId').isUUID(),
    body('memberIds').isArray({ min: 1, max: 50 }),
    body('memberIds.*').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const { memberIds } = req.body;
      const result = await conversationService.addMembers(
        req.userId!,
        req.params.conversationId,
        memberIds
      );
      res.json(result);
    } catch (e: any) {
      res.status(403).json({ message: e.message });
    }
  }
);

// 2.2 Xóa thành viên
router.delete('/:conversationId/members/:memberId',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('memberId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      await conversationService.removeMember(
        req.userId!,
        req.params.conversationId,
        req.params.memberId
      );
      res.json({ message: 'Member removed successfully' });
    } catch (e: any) {
      res.status(403).json({ message: e.message });
    }
  }
);

// 2.3 Rời conversation
router.post('/:conversationId/leave',
  authenticate,
  [
    param('conversationId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      await conversationService.leaveConversation(
        req.userId!,
        req.params.conversationId
      );
      res.json({ message: 'Left conversation successfully' });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

// 2.4 Cập nhật vai trò thành viên
router.patch('/:conversationId/members/:memberId/role',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('memberId').isUUID(),
    body('role').isIn(['admin', 'member']),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const { role } = req.body;
      const result = await conversationService.updateMemberRole(
        req.userId!,
        req.params.conversationId,
        req.params.memberId,
        role.toUpperCase()
      );
      res.json(result);
    } catch (e: any) {
      res.status(403).json({ message: e.message });
    }
  }
);

// 2.5 Cập nhật cài đặt cá nhân
router.patch('/:conversationId/settings',
  authenticate,
  [
    param('conversationId').isUUID(),
    body('nickname').optional().isString().isLength({ max: 100 }),
    body('isMuted').optional().isBoolean(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const { nickname, isMuted } = req.body;
      const result = await conversationService.updateUserSettings(
        req.userId!,
        req.params.conversationId,
        nickname,
        isMuted
      );
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

// 3. Quản lý Lời mời nhóm

// 3.1 Gửi lời mời
router.post('/:conversationId/invites',
  authenticate,
  [
    param('conversationId').isUUID(),
    body('userIds').isArray({ min: 1, max: 50 }),
    body('userIds.*').isUUID(),
    body('message').optional().isString().isLength({ max: 500 }),
    body('expiresInHours').optional().isInt({ min: 1, max: 168 }),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const { userIds, message, expiresInHours } = req.body;
      const result = await conversationService.sendInvites(
        req.userId!,
        req.params.conversationId,
        userIds,
        message,
        expiresInHours
      );
      res.status(201).json(result);
    } catch (e: any) {
      res.status(403).json({ message: e.message });
    }
  }
);

// 3.2 Lấy lời mời đang chờ
router.get('/invites/pending',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'accepted', 'rejected']),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const status = req.query.status as string | undefined;
      const result = await conversationService.getPendingInvites(
        req.userId!,
        page,
        limit,
        status?.toUpperCase()
      );
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

// 3.3 Chấp nhận lời mời
router.post('/:conversationId/invites/:inviteId/accept',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('inviteId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const result = await conversationService.acceptInvite(
        req.userId!,
        req.params.conversationId,
        req.params.inviteId
      );
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

// 3.4 Từ chối lời mời
router.post('/:conversationId/invites/:inviteId/reject',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('inviteId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      await conversationService.rejectInvite(
        req.userId!,
        req.params.conversationId,
        req.params.inviteId
      );
      res.json({ message: 'Invite rejected' });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

// 3.5 Hủy lời mời
router.post('/:conversationId/invites/:inviteId/cancel',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('inviteId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      await conversationService.cancelInvite(
        req.userId!,
        req.params.conversationId,
        req.params.inviteId
      );
      res.json({ message: 'Invite cancelled' });
    } catch (e: any) {
      res.status(403).json({ message: e.message });
    }
  }
);

// 4. Quản lý Poll (Bình chọn)

// 4.1 Tạo poll
router.post('/:conversationId/polls',
  authenticate,
  [
    param('conversationId').isUUID(),
    body('question').isString().isLength({ min: 1, max: 500 }),
    body('options').isArray({ min: 2, max: 20 }),
    body('options.*').isString().isLength({ min: 1, max: 200 }),
    body('allow_multiple').optional().isBoolean(),
    body('allow_add_option').optional().isBoolean(),
    body('is_anonymous').optional().isBoolean(),
    body('expires_in_hours').optional().isInt({ min: 1, max: 168 }),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const pollData = req.body;
      const poll = await conversationService.createPoll(
        req.userId!,
        req.params.conversationId,
        pollData
      );
      res.status(201).json(poll);
    } catch (e: any) {
      res.status(403).json({ message: e.message });
    }
  }
);

// 4.2 Lấy danh sách polls
router.get('/:conversationId/polls',
  authenticate,
  [
    param('conversationId').isUUID(),
    query('status').optional().isIn(['open', 'closed']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const status = req.query.status as string | undefined;
      const result = await conversationService.listPolls(
        req.userId!,
        req.params.conversationId,
        status?.toUpperCase(),
        page,
        limit
      );
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

// 4.3 Chi tiết poll
router.get('/:conversationId/polls/:pollId',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('pollId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const poll = await conversationService.getPollDetails(
        req.userId!,
        req.params.conversationId,
        req.params.pollId
      );
      res.json(poll);
    } catch (e: any) {
      res.status(404).json({ message: e.message });
    }
  }
);

// 4.4 Chỉnh sửa poll
router.patch('/:conversationId/polls/:pollId',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('pollId').isUUID(),
    body('question').optional().isString().isLength({ min: 1, max: 500 }),
    body('allow_multiple').optional().isBoolean(),
    body('allow_add_option').optional().isBoolean(),
    body('expires_at').optional().isISO8601(),
    body('edited_option_labels').optional().isArray(),
    body('edited_option_labels.*.id').isUUID(),
    body('edited_option_labels.*.label').isString().isLength({ min: 1, max: 200 }),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const updateData = req.body;
      const poll = await conversationService.updatePoll(
        req.userId!,
        req.params.conversationId,
        req.params.pollId,
        updateData
      );
      res.json(poll);
    } catch (e: any) {
      res.status(403).json({ message: e.message });
    }
  }
);

// 4.5 Bình chọn
router.post('/:conversationId/polls/:pollId/vote',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('pollId').isUUID(),
    body('option_ids').isArray({ min: 1, max: 20 }),
    body('option_ids.*').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const { option_ids } = req.body;
      const result = await conversationService.votePoll(
        req.userId!,
        req.params.conversationId,
        req.params.pollId,
        option_ids
      );
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

// 4.6 Thu hồi bình chọn
router.delete('/:conversationId/polls/:pollId/vote',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('pollId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      await conversationService.withdrawVote(
        req.userId!,
        req.params.conversationId,
        req.params.pollId
      );
      res.json({ message: 'Vote withdrawn' });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

// 4.7 Thêm lựa chọn
router.post('/:conversationId/polls/:pollId/options',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('pollId').isUUID(),
    body('label').isString().isLength({ min: 1, max: 200 }),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const { label } = req.body;
      const result = await conversationService.addPollOption(
        req.userId!,
        req.params.conversationId,
        req.params.pollId,
        label
      );
      res.status(201).json(result);
    } catch (e: any) {
      res.status(403).json({ message: e.message });
    }
  }
);

// 4.8 Xóa lựa chọn
router.delete('/:conversationId/polls/:pollId/options/:optionId',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('pollId').isUUID(),
    param('optionId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      await conversationService.removePollOption(
        req.userId!,
        req.params.conversationId,
        req.params.pollId,
        req.params.optionId
      );
      res.json({ message: 'Option removed' });
    } catch (e: any) {
      res.status(403).json({ message: e.message });
    }
  }
);

// 4.9 Đóng poll
router.post('/:conversationId/polls/:pollId/close',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('pollId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const poll = await conversationService.closePoll(
        req.userId!,
        req.params.conversationId,
        req.params.pollId
      );
      res.json(poll);
    } catch (e: any) {
      res.status(403).json({ message: e.message });
    }
  }
);

// 5. Quản lý Call (Cuộc gọi)

// 5.1 Lấy ICE servers
router.get('/ice-servers',
  authenticate,
  async (req: AuthReq, res: Response) => {
    try {
      const iceServers = await conversationService.getIceServers();
      res.json(iceServers);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  }
);

// 5.2 Lịch sử cuộc gọi
router.get('/:conversationId/calls',
  authenticate,
  [
    param('conversationId').isUUID(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const result = await conversationService.getCallHistory(
        req.userId!,
        req.params.conversationId,
        page,
        limit
      );
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

// 5.3 Trạng thái cuộc gọi
router.get('/:conversationId/call-state',
  authenticate,
  [
    param('conversationId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const callState = await conversationService.getCallState(
        req.userId!,
        req.params.conversationId
      );
      res.json(callState);
    } catch (e: any) {
      res.status(404).json({ message: e.message });
    }
  }
);

// 5.4 Kết thúc cuộc gọi
router.post('/:conversationId/calls/:callId/end',
  authenticate,
  [
    param('conversationId').isUUID(),
    param('callId').isUUID(),
    body('reason').optional().isString().isLength({ max: 255 }),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const { reason } = req.body;
      const result = await conversationService.endCall(
        req.userId!,
        req.params.conversationId,
        req.params.callId,
        reason
      );
      res.json(result);
    } catch (e: any) {
      res.status(403).json({ message: e.message });
    }
  }
);

// 6. Các chức năng khác

// 6.1 Đánh dấu đã đọc
router.post('/:conversationId/read',
  authenticate,
  [
    param('conversationId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      await conversationService.markAsRead(
        req.userId!,
        req.params.conversationId
      );
      res.json({ message: 'Conversation marked as read' });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

// 6.2 Ghim conversation
router.post('/:conversationId/pin',
  authenticate,
  [
    param('conversationId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      await conversationService.pinConversation(
        req.userId!,
        req.params.conversationId
      );
      res.json({ message: 'Conversation pinned' });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

// 6.3 Bỏ ghim conversation
router.delete('/:conversationId/pin',
  authenticate,
  [
    param('conversationId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      await conversationService.unpinConversation(
        req.userId!,
        req.params.conversationId
      );
      res.json({ message: 'Conversation unpinned' });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  }
);

// 6.4 Cập nhật cài đặt nhóm
router.patch('/:conversationId/group-settings',
  authenticate,
  [
    param('conversationId').isUUID(),
    body('permissions').optional().isObject(),
    body('policies').optional().isObject(),
    body('features').optional().isObject(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const { permissions, policies, features } = req.body;
      const result = await conversationService.updateGroupSettings(
        req.userId!,
        req.params.conversationId,
        permissions,
        policies,
        features
      );
      res.json(result);
    } catch (e: any) {
      res.status(403).json({ message: e.message });
    }
  }
);

// 6.5 Giải tán nhóm
router.post('/:conversationId/disband',
  authenticate,
  [
    param('conversationId').isUUID(),
  ],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      await conversationService.disbandGroup(
        req.userId!,
        req.params.conversationId
      );
      res.json({ message: 'Group disbanded' });
    } catch (e: any) {
      res.status(403).json({ message: e.message });
    }
  }
);

export default router;
