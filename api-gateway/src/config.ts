import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET!,
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    chat: process.env.CHAT_SERVICE_URL || 'http://localhost:3003',
  },
};
