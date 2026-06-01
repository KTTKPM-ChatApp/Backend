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
  ai: {
    provider: process.env.AI_PROVIDER || 'openrouter',
    apiKey: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || '',
    model: process.env.AI_MODEL || process.env.OPENROUTER_MODEL || process.env.GEMINI_MODEL || 'openrouter/free',
    baseUrl: process.env.AI_BASE_URL || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
  },
};
