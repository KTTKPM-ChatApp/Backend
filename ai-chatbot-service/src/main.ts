import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { AppDataSource, ensureDatabase } from './db';
import { config } from './config';
import chatbotRouter from './chatbot/chatbot.router';

const app = express();
app.use(cors(), express.json());

app.use('/chatbot', chatbotRouter);

app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'ai-chatbot-service',
    timestamp: new Date().toISOString(),
  });
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelay(attempt: number, baseMs: number, maxMs: number) {
  const exponential = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * Math.min(baseMs, exponential) * 0.25);
  return exponential + jitter;
}

async function initDatabaseWithRetry() {
  const attempts = config.db.connectRetryAttempts;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await ensureDatabase();
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }
      console.log('Database connected');
      return;
    } catch (error: any) {
      const code = error?.code || 'UNKNOWN';
      const message = error?.message || 'Unknown database error';
      console.error(
        `[DB] Connection attempt ${attempt}/${attempts} failed (${code}): ${message}`
      );

      if (attempt >= attempts) {
        throw error;
      }

      const delayMs = retryDelay(
        attempt,
        config.db.connectRetryDelayMs,
        config.db.connectRetryMaxDelayMs
      );
      console.log(
        `[DB] Retrying in ${delayMs}ms (host=${config.db.host}, port=${config.db.port}, db=${config.db.database})`
      );
      await sleep(delayMs);
    }
  }
}

async function bootstrap() {
  try {
    await initDatabaseWithRetry();

    app.listen(config.port, () => {
      console.log(`ai-chatbot-service running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(0);
});

bootstrap();
