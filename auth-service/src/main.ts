import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { AppDataSource, ensureDatabase, initializeDataSource } from './db';
import { config } from './config';
import { connectRabbitMQ, closeRabbitMQ } from './rabbitmq';
<<<<<<< HEAD
import authRouter from './auth/auth.router';
import userRouter from './user/user.router';
import friendRouter from './friend/friend.router';
=======
import { connectRedis, closeRedis } from './redis';
import authRouter from './auth/auth.router';
import userRouter from './user/user.router';
import friendRouter from './friend/friend.router';
import presenceRouter from './presence/presence.router';
>>>>>>> origin/main

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
<<<<<<< HEAD
=======
app.use('/api/presence', presenceRouter);
>>>>>>> origin/main
app.get('/health', (_, res) => res.json({ status: 'ok' }));

async function bootstrap() {
  try {
    await ensureDatabase();
    await initializeDataSource();
    await connectRabbitMQ();
<<<<<<< HEAD
=======
    await connectRedis();
>>>>>>> origin/main
    app.listen(config.port, () => console.log(`auth-service :${config.port}`));
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  await closeRabbitMQ();
<<<<<<< HEAD
=======
  await closeRedis();
>>>>>>> origin/main
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(0);
});

bootstrap();
