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
    authSwitchHandler: () => {},
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE || 'chat.events',
    routingKeyNewMessage: process.env.RABBITMQ_ROUTING_KEY_NEW_MESSAGE || 'chat.new_message',
  },
  realtimeService: {
    // URL của realtime-service (Java/Spring Boot). Để trống nếu chưa deploy.
    url: process.env.REALTIME_SERVICE_URL || '',
    // Shared secret dùng cho inter-service communication
    internalApiKey: process.env.INTERNAL_API_KEY || '',
  },
};
