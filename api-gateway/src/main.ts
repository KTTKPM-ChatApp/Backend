import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { config } from './config';
import { authenticate } from './middleware';
import { proxy } from './proxy';
import multer from 'multer';
import { setupSocketIO, notifyConversation, notifyNewConversation, notifyMessageRead, isUserOnline, getOnlineUserIds } from './socket-handler';
import { generateCloudinarySignature } from './cloudinary';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth routes (public)
app.post('/api/auth/register', (req, res) => proxy(req, res, `${config.services.auth}/auth/register`));
app.post('/api/auth/login', (req, res) => proxy(req, res, `${config.services.auth}/auth/login`));
app.post('/api/auth/refresh', (req, res) => proxy(req, res, `${config.services.auth}/auth/refresh`));
app.post('/api/auth/logout', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/auth/logout`));
app.post('/api/auth/change-password', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/auth/change-password`));

// User routes (protected)
app.get('/api/users/me', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/users/me`));
app.put('/api/users/me', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/users/me`));
app.get('/api/users/search', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/users/search`));
app.get('/api/users/:id', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/users/${req.params.id}`));

// 1. Quản lý Conversation cơ bản

// 1.1 Lấy danh sách conversations
app.get('/api/conversations', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations`, true));

// 1.2 Lấy conversation theo ID
app.get('/api/conversations/:conversationId', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}`, true));

// 1.3 Tạo conversation nhóm
app.post('/api/conversations/group', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/group`, true));

// 1.4 Tạo conversation trực tiếp
app.post('/api/conversations/direct', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/direct`, true));

// 1.5 Cập nhật conversation
app.patch('/api/conversations/:conversationId', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}`, true));

// Keep old routes for backward compatibility
app.post('/api/conversations', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations`, true));

// 2. Quản lý Thành viên

// 2.1 Thêm thành viên
app.post('/api/conversations/:conversationId/members', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/members`, true));

// 2.2 Xóa thành viên
app.delete('/api/conversations/:conversationId/members/:memberId', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/members/${req.params.memberId}`, true));

// 2.3 Rời conversation
app.post('/api/conversations/:conversationId/leave', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/leave`, true));

// 2.4 Chuyển quyền trưởng nhóm
app.post('/api/conversations/:conversationId/transfer-ownership', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/transfer-ownership`, true));

// 2.5 Cập nhật vai trò thành viên
app.patch('/api/conversations/:conversationId/members/:memberId/role', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/members/${req.params.memberId}/role`, true));

// 2.6 Cập nhật cài đặt cá nhân
app.patch('/api/conversations/:conversationId/settings', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/settings`, true));

// 3. Quản lý Lời mời nhóm

// 3.1 Gửi lời mời
app.post('/api/conversations/:conversationId/invites', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/invites`, true));

// 3.2 Lấy lời mời đang chờ
app.get('/api/conversations/invites/pending', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/invites/pending`, true));

// 3.3 Chấp nhận lời mời
app.post('/api/conversations/:conversationId/invites/:inviteId/accept', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/invites/${req.params.inviteId}/accept`, true));

// 3.4 Từ chối lời mời
app.post('/api/conversations/:conversationId/invites/:inviteId/reject', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/invites/${req.params.inviteId}/reject`, true));

// 3.5 Hủy lời mời
app.post('/api/conversations/:conversationId/invites/:inviteId/cancel', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/invites/${req.params.inviteId}/cancel`, true));

// 4. Quản lý Poll (Bình chọn)

// 4.1 Tạo poll
app.post('/api/conversations/:conversationId/polls', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/polls`, true));

// 4.2 Lấy danh sách polls
app.get('/api/conversations/:conversationId/polls', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/polls`, true));

// 4.3 Chi tiết poll
app.get('/api/conversations/:conversationId/polls/:pollId', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/polls/${req.params.pollId}`, true));

// 4.4 Chỉnh sửa poll
app.patch('/api/conversations/:conversationId/polls/:pollId', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/polls/${req.params.pollId}`, true));

// 4.5 Bình chọn
app.post('/api/conversations/:conversationId/polls/:pollId/vote', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/polls/${req.params.pollId}/vote`, true));

// 4.6 Thu hồi bình chọn
app.delete('/api/conversations/:conversationId/polls/:pollId/vote', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/polls/${req.params.pollId}/vote`, true));

// 4.7 Thêm lựa chọn
app.post('/api/conversations/:conversationId/polls/:pollId/options', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/polls/${req.params.pollId}/options`, true));

// 4.8 Xóa lựa chọn
app.delete('/api/conversations/:conversationId/polls/:pollId/options/:optionId', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/polls/${req.params.pollId}/options/${req.params.optionId}`, true));

// 4.9 Đóng poll
app.post('/api/conversations/:conversationId/polls/:pollId/close', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/polls/${req.params.pollId}/close`, true));

// 5. Quản lý Call (Cuộc gọi)

// 5.1 Lấy ICE servers
app.get('/api/conversations/ice-servers', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/ice-servers`, true));

// 5.2 Lịch sử cuộc gọi
app.get('/api/conversations/:conversationId/calls', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/calls`, true));

// 5.3 Trạng thái cuộc gọi
app.get('/api/conversations/:conversationId/call-state', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/call-state`, true));

// 5.4 Kết thúc cuộc gọi
app.post('/api/conversations/:conversationId/calls/:callId/end', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/calls/${req.params.callId}/end`, true));

// 6. Các chức năng khác

// 6.1 Đánh dấu đã đọc
app.post('/api/conversations/:conversationId/read', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/read`, true));

// 6.2 Ghim conversation
app.post('/api/conversations/:conversationId/pin', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/pin`, true));

// 6.3 Bỏ ghim conversation
app.delete('/api/conversations/:conversationId/pin', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/pin`, true));

// 6.4 Cập nhật cài đặt nhóm
app.patch('/api/conversations/:conversationId/group-settings', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/group-settings`, true));

// 6.5 Giải tán nhóm
app.post('/api/conversations/:conversationId/disband', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/disband`, true));

// Message routes (backward compatibility)
app.get('/api/conversations/:conversationId/messages', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/messages`, true));
app.post('/api/conversations/:conversationId/messages', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.conversationId}/messages`, true));

// 7. Message management routes
app.get('/api/messages/:conversationId', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/messages/${req.params.conversationId}`, true));
app.get('/api/messages/:conversationId/search', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/messages/${req.params.conversationId}/search`, true));
app.get('/api/messages/:conversationId/:createdAt/:messageId', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/messages/${req.params.conversationId}/${req.params.createdAt}/${req.params.messageId}`, true));
app.patch('/api/messages/:conversationId/:createdAt/:messageId', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/messages/${req.params.conversationId}/${req.params.createdAt}/${req.params.messageId}`, true));
app.delete('/api/messages/:conversationId/:createdAt/:messageId', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/messages/${req.params.conversationId}/${req.params.createdAt}/${req.params.messageId}`, true));
app.post('/api/messages/forward', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/messages/forward`, true));
app.post('/api/messages/:conversationId/:createdAt/:messageId/pin', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/messages/${req.params.conversationId}/${req.params.createdAt}/${req.params.messageId}/pin`, true));
app.delete('/api/messages/:conversationId/:createdAt/:messageId/pin', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/messages/${req.params.conversationId}/${req.params.createdAt}/${req.params.messageId}/pin`, true));
app.get('/api/messages/:conversationId/pins', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/messages/${req.params.conversationId}/pins`, true));
app.get('/api/messages/:messageId/reactions', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/messages/${req.params.messageId}/reactions`, true));
app.get('/api/v1/messages/lookup/:messageId', (req, res) => proxy(req, res, `${config.services.chat}/messages/v1/messages/lookup/${req.params.messageId}`));

// Friend routes (protected)
app.get('/api/friends', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/friends`));
app.get('/api/friends/requests/pending', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/friends/requests/pending`));
app.get('/api/friends/requests/sent', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/friends/requests/sent`));
app.post('/api/friends/requests', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/friends/requests`));
app.put('/api/friends/requests/:requestId', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/friends/requests/${req.params.requestId}`));
app.delete('/api/friends/requests/:requestId', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/friends/requests/${req.params.requestId}`));
app.delete('/api/friends/:friendId', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/friends/${req.params.friendId}`));
app.post('/api/friends/:userId/block', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/friends/${req.params.userId}/block`));
app.delete('/api/friends/:userId/block', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/friends/${req.params.userId}/block`));

// Cloudinary signed upload (protected)
app.post('/api/media/cloudinary-sign', authenticate, (req, res) => {
  try {
    const { resourceType } = req.body;
    const userId = (req as any).userId;
    const folder = `${config.cloudinary.uploadFolder}/${userId}`;

    const signResult = generateCloudinarySignature({
      resourceType: resourceType || 'auto',
      folder,
    });

    res.json({ success: true, data: signResult });
  } catch (error) {
    console.error('[Cloudinary Sign Error]', error);
    res.status(500).json({ message: 'Failed to generate Cloudinary signature' });
  }
});

// Media upload routes (protected)
app.post('/api/media/upload', authenticate, upload.single('file'), (req, res) => proxy(req, res, `${config.services.chat}/media/upload`, true));

// Internal callback for chat-service to push real-time notifications
app.post('/api/internal/message-callback', (req, res) => {
  const apiKey = req.headers['x-internal-api-key'];
  if (!apiKey || apiKey !== config.internalApiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { conversationId, message } = req.body;
  if (conversationId && message) {
    notifyConversation(conversationId, message);
  }
  res.json({ ok: true });
});

// Internal callback for new conversation created
app.post('/api/internal/conversation-callback', (req, res) => {
  const apiKey = req.headers['x-internal-api-key'];
  if (!apiKey || apiKey !== config.internalApiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { conversation } = req.body;
  if (conversation) {
    notifyNewConversation(conversation);
  }
  res.json({ ok: true });
});

// Internal callback for message read event
app.post('/api/internal/message-read-callback', (req, res) => {
  const apiKey = req.headers['x-internal-api-key'];
  if (!apiKey || apiKey !== config.internalApiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { conversationId, userId, messageId } = req.body;
  if (conversationId && userId && messageId) {
    notifyMessageRead(conversationId, userId, messageId);
  }
  res.json({ ok: true });
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.get('/api/presence/online', authenticate, (_, res) => {
  res.json({ success: true, data: getOnlineUserIds() });
});

const httpServer = createServer(app);
setupSocketIO(httpServer);

httpServer.listen(config.port, () => console.log(`API Gateway :${config.port}`));
