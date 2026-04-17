import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { AppDataSource, ensureDatabase } from './db';
import { config } from './config';
import { connectRabbitMQ, closeRabbitMQ } from './rabbitmq';
import chatRouter from './chat/chat.router';

const app = express();
app.use(cors(), express.json());

app.use('/conversations', chatRouter);
app.get('/health', (_, res) => res.json({ status: 'ok' }));

async function bootstrap() {
  try {
    await ensureDatabase();
    await AppDataSource.initialize();
    console.log('Database connected');
    
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
  await AppDataSource.destroy();
  process.exit(0);
});

bootstrap();
