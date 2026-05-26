import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { AppDataSource, ensureDatabase, initializeDataSource } from './db';
import { config } from './config';
import { connectRabbitMQ, closeRabbitMQ } from './rabbitmq';
import authRouter from './auth/auth.router';
import userRouter from './user/user.router';
import friendRouter from './friend/friend.router';

const app = express();
app.use(cors(), express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, please try again later' },
});

app.use('/auth', authLimiter, authRouter);
app.use('/users', userRouter);
app.use('/friends', friendRouter);
app.get('/health', (_, res) => res.json({ status: 'ok' }));

async function bootstrap() {
  try {
    await ensureDatabase();
    await initializeDataSource();
    await connectRabbitMQ();
    app.listen(config.port, () => console.log(`auth-service :${config.port}`));
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
