import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource, User, RefreshToken } from '../db';
import { config } from '../config';

interface JwtPayload {
  sub: string;
  email: string;
}

const MAX_REFRESH_TOKENS = 5;

const userRepo = () => AppDataSource.getRepository(User);
const tokenRepo = () => AppDataSource.getRepository(RefreshToken);

export async function register(username: string, email: string, password: string, displayName: string, dateOfBirth?: Date, gender?: string, bio?: string, phone?: string) {
  if (await userRepo().findOneBy({ email })) throw new Error('Email already in use');
  if (await userRepo().findOneBy({ username })) throw new Error('Username already taken');

  const user = userRepo().create({
    username, 
    email, 
    displayName,
    dateOfBirth,
    gender,
    bio,
    phone,
    passwordHash: await bcrypt.hash(password, 10),
  });
  const saved = await userRepo().save(user);
  const { passwordHash: _, ...pub } = saved;
  return pub;
}

export async function login(email: string, password: string) {
  const user = await userRepo().findOneBy({ email });
  if (!user || !user.isActive) throw new Error('Invalid credentials');
  if (!await bcrypt.compare(password, user.passwordHash)) throw new Error('Invalid credentials');

  const payload = { sub: user.id, email: user.email };
  const accessToken = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn as any });
  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn as any });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  await tokenRepo().save(tokenRepo().create({ userId: user.id, token: refreshToken, expiresAt }));

  const existing = await tokenRepo().find({ where: { userId: user.id }, order: { createdAt: 'ASC' } });
  if (existing.length > MAX_REFRESH_TOKENS) {
    const toDelete = existing.slice(0, existing.length - MAX_REFRESH_TOKENS);
    await tokenRepo().remove(toDelete);
  }

  const { passwordHash: _, ...pub } = user;
  return { accessToken, refreshToken, user: pub };
}

export async function refresh(refreshToken: string) {
  const record = await tokenRepo().findOneBy({ token: refreshToken });
  if (!record || record.expiresAt < new Date()) throw new Error('Invalid or expired refresh token');

  const p = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;
  const accessToken = jwt.sign({ sub: p.sub, email: p.email }, config.jwt.secret, { expiresIn: config.jwt.expiresIn as any });
  return { accessToken };
}

export async function logout(userId: string, refreshToken?: string) {
  if (refreshToken) await tokenRepo().delete({ token: refreshToken });
  else await tokenRepo().delete({ userId });
}
