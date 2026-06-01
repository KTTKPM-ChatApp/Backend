import { Request, Response } from 'express';
import axios from 'axios';
import http from 'http';
import https from 'https';
import { AuthReq } from './middleware';
import { config } from './config';

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'ENOTFOUND',
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasIdempotencyKey(req: Request | AuthReq): boolean {
  return Boolean(req.headers['idempotency-key'] || req.headers['x-idempotency-key']);
}

function canRetryRequest(req: Request | AuthReq): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(req.method) || hasIdempotencyKey(req);
}

function shouldRetryError(error: any): boolean {
  return RETRYABLE_ERROR_CODES.has(error?.code);
}

export async function proxy(req: Request | AuthReq, res: Response, url: string, addUserId = false) {
  const retryableRequest = canRetryRequest(req);
  let lastError: any;

  try {
    const headers: any = {};
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
    if (req.headers['idempotency-key']) headers['Idempotency-Key'] = req.headers['idempotency-key'];
    if (req.headers['x-idempotency-key']) headers['X-Idempotency-Key'] = req.headers['x-idempotency-key'];
    
    const userId = (req as AuthReq).userId;
    
    if (addUserId && userId) {
      headers['x-user-id'] = userId;
    }

    const attempts = Math.max(1, config.proxy.retryAttempts);

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await axios({
          method: req.method,
          url,
          data: req.body,
          params: req.query,
          headers,
          httpAgent,
          httpsAgent,
          timeout: config.proxy.timeoutMs,
          validateStatus: () => true,
        });

        if (
          retryableRequest &&
          attempt < attempts &&
          RETRYABLE_STATUS_CODES.has(response.status)
        ) {
          console.warn(
            `[API Gateway] Proxy ${req.method} ${url} returned ${response.status}; retrying in ${config.proxy.retryDelayMs}ms (${attempt}/${attempts})`,
          );
          await sleep(config.proxy.retryDelayMs);
          continue;
        }

        res.status(response.status).json(response.data);
        return;
      } catch (error: any) {
        lastError = error;

        if (retryableRequest && attempt < attempts && shouldRetryError(error)) {
          console.warn(
            `[API Gateway] Proxy ${req.method} ${url} failed with ${error?.code || error?.message}; retrying in ${config.proxy.retryDelayMs}ms (${attempt}/${attempts})`,
          );
          await sleep(config.proxy.retryDelayMs);
          continue;
        }

        throw error;
      }
    }
  } catch (error: any) {
    const finalError = lastError || error;
    console.error('[API Gateway] Proxy error:', finalError);
    console.error('[API Gateway] Error details:', finalError?.response?.data || finalError?.message);
    if (finalError.code === 'ECONNABORTED' || finalError.code === 'ETIMEDOUT') {
      res.status(504).json({ message: 'Gateway timeout' });
    } else if (finalError.code === 'ECONNREFUSED') {
      res.status(503).json({ message: 'Service unavailable' });
    } else {
      res.status(500).json({ message: 'Gateway error', details: finalError?.message });
    }
  }
}
