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
    const users = await userService.search(
      req.query.q as string,
      req.query.limit ? Number(req.query.limit) : 20,
      req.query.offset ? Number(req.query.offset) : 0,
    );
    res.json({ users });
  }
);

/**
 * GET /users/:id
 * @header Authorization Bearer <accessToken>
 * @param  id string (uuid)
 */
router.get('/:id', authenticate, async (req: AuthReq, res: Response) => {
  try { res.json(await userService.getById(req.params.id)); }
  catch (e: any) { res.status(404).json({ message: e.message }); }
});

/**
 * PUT /users/me
 * @header Authorization Bearer <accessToken>
 * @body displayName?, bio?, avatarUrl?, dateOfBirth?, gender?, email?
 */
router.put('/me', authenticate, async (req: AuthReq, res: Response) => {
  try {
    console.log('PUT /users/me - Request body:', req.body);
    console.log('PUT /users/me - Request userId:', req.userId);
    const updatedUser = await userService.updateById(req.userId!, req.body);
    console.log('PUT /users/me - Updated user:', updatedUser);
    res.json(updatedUser);
  } catch (e: any) { 
    console.log('PUT /users/me - Error:', e.message);
    res.status(400).json({ message: e.message }); 
  }
});

export default router;
