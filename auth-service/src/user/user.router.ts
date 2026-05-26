import { Router, Response } from 'express';
import { query } from 'express-validator';
import { authenticate, validate, AuthReq } from '../middleware';
import * as userService from './user.service';

const router = Router();

/**
 * GET /users/me
 * @header Authorization Bearer <accessToken>
 */
router.get('/me', authenticate, async (req: AuthReq, res: Response) => {
  try { res.json(await userService.getById(req.userId!)); }
  catch (e: any) { res.status(404).json({ message: e.message }); }
});

/**
 * GET /users/all
 * No auth — returns all active users, used by chat-service for initial sync
 */
router.get('/all', async (_req: AuthReq, res: Response) => {
  try {
    const users = await userService.getAll();
    res.json({ success: true, data: users });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * GET /users/batch?ids=id1,id2,id3
 * No auth — used by chat-service for batch user lookup
 */
router.get('/batch',
  [query('ids').isString().notEmpty()],
  validate,
  async (req: AuthReq, res: Response) => {
    try {
      const ids = (req.query.ids as string).split(',').filter(Boolean);
      const users = await userService.getByIds(ids);
      res.json({ success: true, data: users });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message });
    }
  }
);

/**
 * GET /users/search
 * @header Authorization Bearer <accessToken>
 * @query  q      string (required)
 * @query  limit  number (default 20, max 100)
 * @query  offset number (default 0)
 */
router.get('/search',
  authenticate,
  [query('q').trim().notEmpty(), query('limit').optional().isInt({ min: 1, max: 100 }), query('offset').optional().isInt({ min: 0 })],
  validate,
  async (req: AuthReq, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    
    const users = await userService.search(
      req.query.q as string,
      limit,
      offset,
      req.userId,
    );
    
    res.json({
      success: true,
      data: users,
      meta: {
        total: users.length,
        page: Math.floor(offset / limit) + 1,
        limit: limit,
        totalPages: Math.ceil(users.length / limit)
      },
      message: 'Search completed successfully',
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * GET /users/:id
 * @param  id string (uuid)
 * NOTE: Không cần auth vì chat-service cần fetch user info
 */
router.get('/:id', async (req: AuthReq, res: Response) => {
  try { 
    const user = await userService.getById(req.params.id); 
    res.json(user); 
  }
  catch (e: any) { 
    res.status(404).json({ message: e.message }); 
  }
});

/**
 * PUT /users/me
 * @header Authorization Bearer <accessToken>
 * @body displayName?, bio?, avatarUrl?, dateOfBirth?, gender?, email?
 */
router.put('/me', authenticate, async (req: AuthReq, res: Response) => {
  try {
    const updatedUser = await userService.updateById(req.userId!, req.body);
    res.json({
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (e: any) { 
    res.status(400).json({ 
      success: false,
      message: e.message,
      timestamp: new Date().toISOString()
    }); 
  }
});

export default router;
