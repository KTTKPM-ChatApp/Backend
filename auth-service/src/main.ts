import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { AppDataSource, ensureDatabase, initializeDataSource } from './db';
import { config } from './config';
import authRouter from './auth/auth.router';
import userRouter from './user/user.router';
import friendRouter from './friend/friend.router';

const app = express();
app.use(cors(), express.json());

app.use('/auth', authRouter);
app.use('/users', userRouter);
app.use('/friends', friendRouter);
app.get('/health', (_, res) => res.json({ status: 'ok' }));

ensureDatabase()
  .then(() => initializeDataSource())
  .then(() => app.listen(config.port, () => console.log(`auth-service :${config.port}`)))
  .catch((e) => { console.error(e); process.exit(1); });
