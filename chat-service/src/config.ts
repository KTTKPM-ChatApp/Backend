import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3003,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'chat_service',
    connectRetryAttempts: Number(process.env.DB_CONNECT_RETRY_ATTEMPTS) || 20,
    connectRetryDelayMs: Number(process.env.DB_CONNECT_RETRY_DELAY_MS) || 3000,
    connectRetryMaxDelayMs: Number(process.env.DB_CONNECT_RETRY_MAX_DELAY_MS) || 30000,
    authSwitchHandler: () => {},
    poolSize: Number(process.env.DB_POOL_SIZE) || 20,
    poolIdleTimeout: Number(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
    poolMaxIdle: Number(process.env.DB_POOL_MAX_IDLE) || 5,
    replicaHost: process.env.DB_REPLICA_HOST || '',
    replicaPort: Number(process.env.DB_REPLICA_PORT) || 3306,
    replicaUser: process.env.DB_REPLICA_USER || '',
    replicaPassword: process.env.DB_REPLICA_PASS || '',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE || 'chat.events',
    routingKeyNewMessage: process.env.RABBITMQ_ROUTING_KEY_NEW_MESSAGE || 'chat.new_message',
    reconnectInitialDelayMs: Number(process.env.RABBITMQ_RECONNECT_INITIAL_DELAY_MS) || 1000,
    reconnectMaxDelayMs: Number(process.env.RABBITMQ_RECONNECT_MAX_DELAY_MS) || 30000,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    reconnectMaxDelayMs: Number(process.env.REDIS_RECONNECT_MAX_DELAY_MS) || 30000,
  },
  realtimeService: {
    url: process.env.REALTIME_SERVICE_URL || '',
    internalApiKey: process.env.INTERNAL_API_KEY || '',
  },
  authService: {
    url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  },
  gatewayService: {
    url: process.env.GATEWAY_SERVICE_URL || 'http://api-gateway:3000',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    uploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER || 'zalo-chat',
  },
};
