# API Gateway Routes - Conversation Management

## Overview
API Gateway now forwards all conversation management requests to chat-service with proper authentication and proxying.

## Route Categories

### 1. Quản lý Conversation cơ bản

| Method | Endpoint | Description |
|---------|-----------|-------------|
| GET | `/api/conversations` | Lấy danh sách conversations |
| GET | `/api/conversations/:conversationId` | Lấy conversation theo ID |
| POST | `/api/conversations/group` | Tạo conversation nhóm |
| POST | `/api/conversations/direct` | Tạo conversation trực tiếp |
| PATCH | `/api/conversations/:conversationId` | Cập nhật conversation |

### 2. Quản lý Thành viên

| Method | Endpoint | Description |
|---------|-----------|-------------|
| POST | `/api/conversations/:conversationId/members` | Thêm thành viên |
| DELETE | `/api/conversations/:conversationId/members/:memberId` | Xóa thành viên |
| POST | `/api/conversations/:conversationId/leave` | Rời conversation |
| PATCH | `/api/conversations/:conversationId/members/:memberId/role` | Cập nhật vai trò thành viên |
| PATCH | `/api/conversations/:conversationId/settings` | Cập nhật cài đặt cá nhân |

### 3. Quản lý Lời mời nhóm

| Method | Endpoint | Description |
|---------|-----------|-------------|
| POST | `/api/conversations/:conversationId/invites` | Gửi lời mời |
| GET | `/api/conversations/invites/pending` | Lấy lời mời đang chờ |
| POST | `/api/conversations/:conversationId/invites/:inviteId/accept` | Chấp nhận lời mời |
| POST | `/api/conversations/:conversationId/invites/:inviteId/reject` | Từ chối lời mời |
| POST | `/api/conversations/:conversationId/invites/:inviteId/cancel` | Hủy lời mời |

### 4. Quản lý Poll (Bình chọn)

| Method | Endpoint | Description |
|---------|-----------|-------------|
| POST | `/api/conversations/:conversationId/polls` | Tạo poll |
| GET | `/api/conversations/:conversationId/polls` | Lấy danh sách polls |
| GET | `/api/conversations/:conversationId/polls/:pollId` | Chi tiết poll |
| PATCH | `/api/conversations/:conversationId/polls/:pollId` | Chỉnh sửa poll |
| POST | `/api/conversations/:conversationId/polls/:pollId/vote` | Bình chọn |
| DELETE | `/api/conversations/:conversationId/polls/:pollId/vote` | Thu hồi bình chọn |
| POST | `/api/conversations/:conversationId/polls/:pollId/options` | Thêm lựa chọn |
| DELETE | `/api/conversations/:conversationId/polls/:pollId/options/:optionId` | Xóa lựa chọn |
| POST | `/api/conversations/:conversationId/polls/:pollId/close` | Đóng poll |

### 5. Quản lý Call (Cuộc gọi)

| Method | Endpoint | Description |
|---------|-----------|-------------|
| GET | `/api/conversations/ice-servers` | Lấy ICE servers |
| GET | `/api/conversations/:conversationId/calls` | Lịch sử cuộc gọi |
| GET | `/api/conversations/:conversationId/call-state` | Trạng thái cuộc gọi |
| POST | `/api/conversations/:conversationId/calls/:callId/end` | Kết thúc cuộc gọi |

### 6. Các chức năng khác

| Method | Endpoint | Description |
|---------|-----------|-------------|
| POST | `/api/conversations/:conversationId/read` | Đánh dấu đã đọc |
| POST | `/api/conversations/:conversationId/pin` | Ghim conversation |
| DELETE | `/api/conversations/:conversationId/pin` | Bỏ ghim conversation |
| PATCH | `/api/conversations/:conversationId/group-settings` | Cập nhật cài đặt nhóm |
| POST | `/api/conversations/:conversationId/disband` | Giải tán nhóm |

### Legacy Routes (Backward Compatibility)

| Method | Endpoint | Description |
|---------|-----------|-------------|
| GET | `/api/conversations/:conversationId/messages` | Lấy tin nhắn trong conversation |
| POST | `/api/conversations/:conversationId/messages` | Gửi tin nhắn |
| POST | `/api/conversations` | Tạo conversation (legacy) |

## Authentication

All conversation routes require authentication:
- JWT token in `Authorization: Bearer <token>` header
- User ID extracted from token and forwarded as `x-user-id` header to chat-service

## Proxy Configuration

Each route:
1. Validates JWT token and extracts user ID
2. Forwards request to chat-service with proper headers
3. Includes `x-user-id` header for user identification
4. Handles service unavailability gracefully
5. Preserves HTTP status codes and responses

## Error Handling

- **401 Unauthorized**: Invalid or missing JWT token
- **403 Forbidden**: Insufficient permissions
- **503 Service Unavailable**: Chat service not responding
- **500 Gateway Error**: Internal proxy errors

## Features

### Security
- JWT authentication for all endpoints
- User ID forwarding for authorization
- Request validation and sanitization

### Reliability
- Service health checking
- Graceful degradation on service failures
- Proper error propagation

### Performance
- Direct proxying without body parsing overhead
- Connection pooling via axios
- Request/response streaming support

## Configuration

Routes are configured in `src/main.ts` using:
- `config.services.chat` URL for chat-service
- `authenticate` middleware for JWT validation
- `proxy` function for request forwarding

## Testing

All routes can be tested using the same HTTP clients as direct chat-service endpoints, but through the gateway at port 3000 (or configured port).

Example:
```bash
# Get conversations through gateway
curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/conversations

# Creates group conversation
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Group","memberIds":["user1","user2"]}' \
     http://localhost:3000/api/conversations/group
```

## Migration Notes

- All existing client code using `/api/conversations/*` endpoints will continue to work
- New endpoints provide enhanced functionality
- Gradual migration path available for adopting new features
- Legacy routes maintained for backward compatibility
