import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { validate, authenticate, AuthReq } from '../middleware';
import * as authService from './auth.service';

const router = Router();

/**
 * POST /auth/register
 * @body username string (min 3)
 * @body email    string
 * @body password string (min 6)
 * @body displayName string
 * @body dateOfBirth string (optional)
 * @body gender string (optional)
 * @body bio string (optional)
 * @body phone string (optional)
 */
router.post('/register',
  [body('username').trim().isLength({ min: 3 }), body('email').isEmail(), body('password').isLength({ min: 6 }), body('displayName').trim().notEmpty(), body('dateOfBirth').optional(), body('gender').optional(), body('bio').optional(), body('phone').optional()],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { username, email, password, displayName, dateOfBirth, gender, bio, phone } = req.body;
      const user = await authService.register(username, email, password, displayName, dateOfBirth, gender, bio, phone);
      res.status(201).json({ user });
    } catch (e: any) { res.status(409).json({ message: e.message }); }
  }
);

/**
 * POST /auth/login
 * @body email    string
 * @body password string
 */
router.post('/login',
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  async (req: Request, res: Response) => {
    try {
      const result = await authService.login(req.body.email, req.body.password);
      res.json(result);
    } catch (e: any) { res.status(401).json({ message: e.message }); }
  }
);

/**
 * POST /auth/refresh
 * @body refreshToken string
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { res.status(400).json({ message: 'refreshToken required' }); return; }
    res.json(await authService.refresh(refreshToken));
  } catch (e: any) { res.status(401).json({ message: e.message }); }
});

/**
 * POST /auth/logout
 * @header Authorization Bearer <accessToken>
 * @body   refreshToken string (optional — omit to revoke all sessions)
 */
router.post('/logout', authenticate, async (req: AuthReq, res: Response) => {
  await authService.logout(req.userId!, req.body.refreshToken);
  res.json({ message: 'Logged out' });
});

export default router;
