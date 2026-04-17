import { Request, Response } from 'express';
import axios from 'axios';
import { AuthReq } from './middleware';

export async function proxy(req: Request | AuthReq, res: Response, url: string, addUserId = false) {
  try {
    const headers: any = { 'Content-Type': 'application/json' };
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
    if (addUserId && (req as AuthReq).userId) headers['x-user-id'] = (req as AuthReq).userId;

    const response = await axios({
      method: req.method,
      url,
      data: req.body,
      params: req.query,
      headers,
      validateStatus: () => true,
    });

    res.status(response.status).json(response.data);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ message: 'Service unavailable' });
    } else {
      res.status(500).json({ message: 'Gateway error' });
    }
  }
}
