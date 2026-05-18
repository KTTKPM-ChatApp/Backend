import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3003,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'sapassword',
    database: process.env.DB_NAME || 'chat_service',
    connectRetryAttempts: Number(process.env.DB_CONNECT_RETRY_ATTEMPTS) || 20,
    connectRetryDelayMs: Number(process.env.DB_CONNECT_RETRY_DELAY_MS) || 3000,
    authSwitchHandler: () => {},
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE || 'chat.events',
    routingKeyNewMessage: process.env.RABBITMQ_ROUTING_KEY_NEW_MESSAGE || 'chat.new_message',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
  },
  realtimeService: {
    url: process.env.REALTIME_SERVICE_URL || '',
    internalApiKey: process.env.INTERNAL_API_KEY || '',
  },
  authService: {
    url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  },
};
