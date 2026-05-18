import { Request, Response } from 'express';
import axios from 'axios';
import { AuthReq } from './middleware';

export async function proxy(req: Request | AuthReq, res: Response, url: string, addUserId = false) {
  try {
    const headers: any = {};
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
    
    // Always add x-user-id for chat-service endpoints
    const userId = (req as AuthReq).userId;
    
    if (addUserId && userId) {
      headers['x-user-id'] = userId;
    }

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
    console.error('[API Gateway] Proxy error:', error);
    console.error('[API Gateway] Error details:', error?.response?.data || error?.message);
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ message: 'Service unavailable' });
    } else {
      res.status(500).json({ message: 'Gateway error', details: error?.message });
    }
  }
}
