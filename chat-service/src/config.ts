import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3003,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'root',
    database: process.env.DB_NAME || 'chat_service',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE || 'chat.events',
    routingKeyNewMessage: process.env.RABBITMQ_ROUTING_KEY_NEW_MESSAGE || 'chat.new_message',
  },
};
