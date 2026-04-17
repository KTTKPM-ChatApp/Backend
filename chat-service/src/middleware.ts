import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export interface AuthReq extends Request {
  userId?: string;
}

export function authenticate(req: AuthReq, res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    res.status(401).json({ message: 'Missing x-user-id header' });
    return;
  }
  req.userId = userId;
  next();
}

export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
}
