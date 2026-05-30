import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3001,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'auth_service',
    connectRetryAttempts: Number(process.env.DB_CONNECT_RETRY_ATTEMPTS) || 20,
    connectRetryDelayMs: Number(process.env.DB_CONNECT_RETRY_DELAY_MS) || 3000,
    connectRetryMaxDelayMs: Number(process.env.DB_CONNECT_RETRY_MAX_DELAY_MS) || 30000,
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    reconnectInitialDelayMs: Number(process.env.RABBITMQ_RECONNECT_INITIAL_DELAY_MS) || 1000,
    reconnectMaxDelayMs: Number(process.env.RABBITMQ_RECONNECT_MAX_DELAY_MS) || 30000,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    reconnectMaxDelayMs: Number(process.env.REDIS_RECONNECT_MAX_DELAY_MS) || 30000,
  },
};
