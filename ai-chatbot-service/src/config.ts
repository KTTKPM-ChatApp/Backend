import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3005,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'ai_chatbot_service',
    connectRetryAttempts: Number(process.env.DB_CONNECT_RETRY_ATTEMPTS) || 20,
    connectRetryDelayMs: Number(process.env.DB_CONNECT_RETRY_DELAY_MS) || 3000,
    connectRetryMaxDelayMs: Number(process.env.DB_CONNECT_RETRY_MAX_DELAY_MS) || 30000,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
  },
};
