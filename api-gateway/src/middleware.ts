import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config';

export interface AuthReq extends Request {
  userId?: string;
}

export function authenticate(req: AuthReq, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({ message: 'Unauthorized - No auth header' });
    return;
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ message: 'Unauthorized - No token' });
    return;
  }
  
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch (err) {
    console.error('[Auth Middleware] JWT verify error:', err);
    res.status(401).json({ message: 'Invalid token' });
  }
}
