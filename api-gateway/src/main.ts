import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authenticate } from './middleware';
import { proxy } from './proxy';
import multer from 'multer';

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

// User routes (protected)
app.get('/api/users/me', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/users/me`));
app.put('/api/users/me', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/users/me`));
app.get('/api/users/search', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/users/search`));
app.get('/api/users/:id', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/users/${req.params.id}`));

// Chat routes (protected)
app.post('/api/conversations', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations`, true));
app.get('/api/conversations', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations`, true));
app.get('/api/conversations/:id/messages', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.id}/messages`, true));
app.post('/api/conversations/:id/messages', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.id}/messages`, true));

// Media upload routes (protected)
app.post('/api/media/upload', authenticate, upload.single('file'), (req, res) => proxy(req, res, `${config.services.chat}/media/upload`, true));

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(config.port, () => console.log(`API Gateway :${config.port}`));
