import { Request, Response } from 'express';
import axios from 'axios';
import http from 'http';
import https from 'https';
import { AuthReq } from './middleware';

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
const proxyTimeoutMs = Number(process.env.GATEWAY_PROXY_TIMEOUT_MS) || 10000;

export async function proxy(req: Request | AuthReq, res: Response, url: string, addUserId = false) {
  try {
    const headers: any = {};
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
    
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
      httpAgent,
      httpsAgent,
      timeout: proxyTimeoutMs,
      validateStatus: () => true,
    });

    res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error('[API Gateway] Proxy error:', error);
    console.error('[API Gateway] Error details:', error?.response?.data || error?.message);
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      res.status(504).json({ message: 'Gateway timeout' });
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ message: 'Service unavailable' });
    } else {
      res.status(500).json({ message: 'Gateway error', details: error?.message });
    }
  }
}
