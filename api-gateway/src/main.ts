import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authenticate } from './middleware';
import { proxy } from './proxy';

const app = express();
app.use(cors(), express.json());

// Auth routes (public)
app.post('/auth/register', (req, res) => proxy(req, res, `${config.services.auth}/auth/register`));
app.post('/auth/login', (req, res) => proxy(req, res, `${config.services.auth}/auth/login`));
app.post('/auth/refresh', (req, res) => proxy(req, res, `${config.services.auth}/auth/refresh`));
app.post('/auth/logout', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/auth/logout`));

// User routes (protected)
app.get('/users/me', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/users/me`));
app.get('/users/search', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/users/search`));
app.get('/users/:id', authenticate, (req, res) => proxy(req, res, `${config.services.auth}/users/${req.params.id}`));

// Chat routes (protected)
app.post('/conversations', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations`, true));
app.get('/conversations', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations`, true));
app.get('/conversations/:id/messages', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.id}/messages`, true));
app.post('/conversations/:id/messages', authenticate, (req, res) => proxy(req, res, `${config.services.chat}/conversations/${req.params.id}/messages`, true));

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(config.port, () => console.log(`API Gateway :${config.port}`));
