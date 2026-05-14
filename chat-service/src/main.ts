import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { AppDataSource, ensureDatabase } from './db';
import { config } from './config';
import { connectRabbitMQ, closeRabbitMQ, getRabbitMQStatus } from './rabbitmq';
import chatRouter from './chat/chat.router';
import messageRouter from './messages/message.router';

const app = express();
app.use(cors(), express.json());

app.use('/conversations', chatRouter);
// Keep old /chat prefix for backward compatibility
app.use('/chat', chatRouter);
app.use('/messages', messageRouter);

app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'chat-service',
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', async (_, res) => {
  const dbInitialized = AppDataSource.isInitialized;
  let dbPingOk = false;
  let dbError: string | null = null;

  if (dbInitialized) {
    try {
      await AppDataSource.query('SELECT 1');
      dbPingOk = true;
    } catch (error: any) {
      dbError = error?.message || 'Database ping failed';
    }
  } else {
    dbError = 'DataSource is not initialized';
  }

  const rabbit = getRabbitMQStatus();

  const ready = dbInitialized && dbPingOk;
  const statusCode = ready ? 200 : 503;

  res.status(statusCode).json({
    ready,
    checks: {
      database: {
        initialized: dbInitialized,
        ping: dbPingOk,
        error: dbError,
        host: config.db.host,
        port: config.db.port,
        database: config.db.database,
      },
      rabbitmq: rabbit,
    },
    timestamp: new Date().toISOString(),
  });
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function initDatabaseWithRetry() {
  const attempts = config.db.connectRetryAttempts;
  const delayMs = config.db.connectRetryDelayMs;

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

    await connectRabbitMQ();

    app.listen(config.port, () => {
      console.log(`chat-service running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  await closeRabbitMQ();
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(0);
});

bootstrap();
