import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import http from 'http';
import https from 'https';

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 20 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 20 });

export class ClientError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errorCode?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ClientError';
  }
}

export abstract class BaseClient {
  protected abstract get baseUrl(): string;

  protected async request<T>(config: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    headers?: Record<string, string>;
    params?: Record<string, string | number | undefined>;
    data?: unknown;
    timeout?: number;
  }): Promise<T> {
    const url = `${this.baseUrl}${config.path}`;
    const axiosConfig: AxiosRequestConfig = {
      method: config.method,
      url,
      headers: { 'Content-Type': 'application/json', ...config.headers },
      params: config.params,
      data: config.data,
      httpAgent,
      httpsAgent,
      timeout: config.timeout ?? 5000,
      validateStatus: () => true,
    };

    try {
      const res: AxiosResponse = await axios(axiosConfig);
      if (res.status >= 400) {
        throw new ClientError(
          res.status,
          res.data?.message || res.data?.error || 'Request failed',
          undefined,
          res.data,
        );
      }
      return res.data as T;
    } catch (err) {
      if (err instanceof ClientError) throw err;
      const axiosErr = err as any;
      throw new ClientError(
        503,
        axiosErr?.message || 'Service unavailable',
        'SERVICE_UNAVAILABLE',
      );
    }
  }
}
