import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { config } from './config';

export interface AuthReq extends Request {
  userId?: string;
  userEmail?: string;
}

interface JwtPayload {
  sub: string;
  email: string;
}

export function authenticate(req: AuthReq, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { res.status(401).json({ message: 'Unauthorized' }); return; }
  try {
    const p = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.userId = p.sub;
    req.userEmail = p.email;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }
  next();
}
