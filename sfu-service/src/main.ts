import express from 'express';
import cors from 'cors';
import http from 'http';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { SfuManager } from './sfu/SfuManager';
import { RoomManager } from './sfu/Room';
import { setupApiRoutes } from './routes/api';
import { setupWsRoutes } from './routes/ws';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const sfuManager = new SfuManager();
const roomManager = new RoomManager();

app.use((req: any, res, next) => {
  req.sfuManager = sfuManager;
  req.roomManager = roomManager;
  next();
});

const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const apiKey = req.headers['x-internal-api-key'];

  if (apiKey === config.internalApiKey) {
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

app.use('/api/sfu', authenticate, setupApiRoutes(sfuManager, roomManager));
setupWsRoutes(server, sfuManager, roomManager);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    ...sfuManager.getStats(),
  });
});

async function start() {
  await sfuManager.initialize();
  server.listen(config.port, config.listenIp, () => {
    console.log(`[SFU] Server listening on ${config.listenIp}:${config.port}`);
  });
}

start().catch((err) => {
  console.error('[SFU] Failed to start:', err);
  process.exit(1);
});

export { app, server };
