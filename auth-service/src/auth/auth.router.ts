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
      const parsedDateOfBirth = dateOfBirth ? new Date(dateOfBirth) : undefined;
      await authService.register(username, email, password, displayName, parsedDateOfBirth, gender, bio, phone);
      const loginResult = await authService.login(email, password);
      res.status(201).json(loginResult);
    } catch (e: any) {
      const msg = e.message || '';
      if (msg === 'Email already in use' || msg === 'Username already taken') {
        res.status(409).json({ message: msg });
      } else if (msg.includes('login') || msg.includes('password') || msg.includes('Password incorrect') || msg.includes('inactive')) {
        res.status(401).json({ message: 'Đăng ký thành công, nhưng không thể đăng nhập tự động. Vui lòng đăng nhập lại.' });
      } else {
        console.error('[Register] Unexpected error:', e);
        res.status(500).json({ message: 'Lỗi hệ thống, vui lòng thử lại sau' });
      }
    }
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
 * POST /auth/change-password
 * @header Authorization Bearer <accessToken>
 * @body   oldPassword string
 * @body   newPassword string (min 6)
 */
router.post('/change-password',
  authenticate,
  [body('oldPassword').notEmpty(), body('newPassword').isLength({ min: 6 })],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const result = await authService.changePassword(req.userId!, req.body.oldPassword, req.body.newPassword);
      res.json(result);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  }
);

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
