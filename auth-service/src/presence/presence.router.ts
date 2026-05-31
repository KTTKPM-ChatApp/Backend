import { Router, Request, Response } from 'express';
import { setUserOnline, setUserOffline, isUserOnline, getOnlineUserIds } from '../redis';
import { authenticate, AuthReq } from '../middleware';

const router = Router();

function internalApiKeyOnly(req: Request, res: Response, next: Function) {
  const apiKey = req.headers['x-internal-api-key'];
  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
}

// Internal endpoints (service-to-service, called by realtime-service or trusted services)
router.post('/connect', internalApiKeyOnly, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
  await setUserOnline(userId);
  res.json({ success: true });
});

router.post('/disconnect', internalApiKeyOnly, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
  await setUserOffline(userId);
  res.json({ success: true });
});

router.post('/heartbeat', internalApiKeyOnly, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
  await setUserOnline(userId);
  res.json({ success: true });
});

// Public endpoint (user-facing, via Gateway with JWT)
router.get('/online', authenticate, async (req: AuthReq, res) => {
  const targetUserId = req.query.userId as string | undefined;
  if (targetUserId) {
    const online = await isUserOnline(targetUserId);
    return res.json({ success: true, data: online });
  }
  const ids = await getOnlineUserIds();
  res.json({ success: true, data: ids });
});

export default router;
