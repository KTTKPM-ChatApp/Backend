import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET!,
  internalApiKey: process.env.INTERNAL_API_KEY || 'internal-secret-key',
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    chat: process.env.CHAT_SERVICE_URL || 'http://localhost:3003',
    chatbot: process.env.CHATBOT_SERVICE_URL || 'http://localhost:3005',
    realtime: process.env.REALTIME_SERVICE_URL || 'http://localhost:8080',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    reconnectMaxDelayMs: Number(process.env.REDIS_RECONNECT_MAX_DELAY_MS) || 30000,
  },
  proxy: {
    timeoutMs: Number(process.env.GATEWAY_PROXY_TIMEOUT_MS) || 90000,
    retryAttempts: Number(process.env.GATEWAY_PROXY_RETRY_ATTEMPTS) || 2,
    retryDelayMs: Number(process.env.GATEWAY_PROXY_RETRY_DELAY_MS) || 3000,
  },
};
