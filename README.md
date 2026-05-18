# Zalo Chat Application

## Tổng quan

Ứng dụng chat Zalo-like với các tính năng:
- Chat nhắn tin cá nhân và nhóm
- Pin/Unpin tin nhắn
- Gọi thoại/gọi video
- Quản lý bạn bè
- Tìm kiếm người dùng

## Yêu cầu

- Node.js 20+
- Docker & Docker Compose
- MySQL (MariaDB)
- Redis
- RabbitMQ

## Cài đặt

### 1. Clone và cài đặt Backend

```bash
cd Backend
cp .env.example .env
# Chỉnh sửa .env với các giá trị phù hợp
docker-compose up -d
```

### 2. Cài đặt Frontend

```bash
cd Frontend_Web
npm install
npm run dev
```

## Hướng dẫn sử dụng

### Đăng ký tài khoản mới

1. Mở trình duyệt tại `http://localhost:3000`
2. Click "Đăng ký" 
3. Điền thông tin:
   - **Tên đăng nhập**: Ít nhất 3 ký tự
   - **Email**: Địa chỉ email hợp lệ
   - **Mật khẩu**: Ít nhất 6 ký tự
   - **Tên hiển thị**: Tên sẽ hiển thị trong chat

### Đăng nhập

1. Click "Đăng nhập"
2. Nhập **email** và **mật khẩu** đã đăng ký
3. Click nút đăng nhập

### Tạo cuộc trò chuyện mới

1. Click vào icon "Tin nhắn mới" (dấu +)
2. Tìm kiếm người dùng theo tên hoặc email
3. Chọn người để bắt đần chat

### Tạo nhóm chat

1. Click vào icon "Tin nhắn mới"
2. Click "Tạo nhóm"
3. Chọn thành viên từ danh sách bạn bè
4. Đặt tên nhóm và tạo

### Pin tin nhắn

1. Click chuột phải vào tin nhắn
2. Chọn "Ghim" để ghim tin nhắn lên đầu
3. Để bỏ ghim, click chuột phải và chọn "Bỏ ghim"

## API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/change-password` - Đổi mật khẩu

### Conversations
- `GET /api/conversations` - Danh sách cuộc trò chuyện
- `POST /api/conversations` - Tạo cuộc trò chuyện
- `GET /api/conversations/:id` - Chi tiết cuộc trò chuyện
- `DELETE /api/conversations/:id` - Xóa nhóm

### Messages
- `GET /api/conversations/:id/messages` - Danh sách tin nhắn
- `POST /api/conversations/:id/messages` - Gửi tin nhắn
- `DELETE /api/messages/:convId/:createdAt/:msgId` - Xóa tin nhắn
- `POST /api/conversations/:id/:createdAt/:msgId/pin` - Ghim tin nhắn
- `DELETE /api/conversations/:id/:createdAt/:msgId/pin` - Bỏ ghim tin nhắn
- `GET /api/conversations/:id/pins` - Danh sách tin nhắn đã ghim

### Friends
- `GET /api/friends` - Danh sách bạn bè
- `GET /api/friends/requests/pending` - Lời mời kết bạn
- `POST /api/friends/requests` - Gửi lời mời kết bạn
- `PUT /api/friends/requests/:id` - Chấp nhận/Từ chối

## Cấu trúc dự án

```
Backend/
├── api-gateway/     # API Gateway (Port 4321)
├── auth-service/    # Auth Service (Port 3001)
├── chat-service/    # Chat Service (Port 3003)
└── realtime-service/ # Realtime Service (Port 8080)

Frontend_Web/
├── src/
│   ├── app/         # Next.js pages
│   ├── common/     # Shared code (services, hooks, stores)
│   └── components/ # Reusable components
```

## Giải quyết vấn đề

### Không thể đăng nhập
- Kiểm tra backend đang chạy: `docker ps`
- Kiểm tra logs: `docker logs <container-name>`

### Tin nhắn không gửi được
- Kiểm tra kết nối WebSocket
- Kiểm tra logs của chat-service

### Lỗi kết nối database
- Kiểm tra MariaDB đang chạy: `docker ps | grep mariadb`
- Kiểm tra biến môi trường DB trong .env

## License

MIT