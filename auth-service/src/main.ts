import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { AppDataSource, ensureDatabase } from './db';
import { config } from './config';
import authRouter from './auth/auth.router';
import userRouter from './user/user.router';

const app = express();
app.use(cors(), express.json());

app.use('/auth', authRouter);
app.use('/users', userRouter);
app.get('/health', (_, res) => res.json({ status: 'ok' }));

ensureDatabase()
  .then(() => AppDataSource.initialize())
  .then(() => app.listen(config.port, () => console.log(`auth-service :${config.port}`)))
  .catch((e) => { console.error(e); process.exit(1); });
