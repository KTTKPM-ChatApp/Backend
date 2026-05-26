import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource, User, RefreshToken } from '../db';
import { config } from '../config';
import { publishUserCreated } from '../rabbitmq';

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

  let parsedDateOfBirth: Date | undefined;
  if (dateOfBirth) {
    const d = new Date(dateOfBirth);
    if (!isNaN(d.getTime())) {
      parsedDateOfBirth = new Date(d.toISOString().split('T')[0]);
    }
  }

  const user = userRepo().create({
    username, 
    email, 
    displayName,
    dateOfBirth: parsedDateOfBirth,
    gender,
    bio,
    phone,
    passwordHash: await bcrypt.hash(password, 10),
  });
  const saved = await userRepo().save(user);
  publishUserCreated({
    id: saved.id,
    username: saved.username,
    displayName: saved.displayName,
    avatarUrl: saved.avatarUrl,
    email: saved.email,
    isActive: saved.isActive,
    bio: saved.bio,
    gender: saved.gender,
    phone: saved.phone,
  }).catch(() => {});
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

const parseExpiresIn = (val: string): number => {
  const match = val.match(/^(\d+)([dhms])$/);
  if (!match) return 3600;
  const n = parseInt(match[1]);
  switch (match[2]) {
    case 'd': return n * 86400;
    case 'h': return n * 3600;
    case 'm': return n * 60;
    case 's': return n;
    default: return 3600;
  }
};

export async function refresh(refreshToken: string) {
  const record = await tokenRepo().findOneBy({ token: refreshToken });
  if (!record || record.expiresAt < new Date()) throw new Error('Invalid or expired refresh token');

  const p = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;
  const expiresIn = parseExpiresIn(config.jwt.expiresIn as string);
  const accessToken = jwt.sign({ sub: p.sub, email: p.email }, config.jwt.secret, { expiresIn });
  return { accessToken, expiresIn };
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string) {
  const user = await userRepo().findOneBy({ id: userId });
  if (!user) throw new Error('User not found');
  if (!await bcrypt.compare(oldPassword, user.passwordHash)) throw new Error('Current password is incorrect');
  
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await userRepo().save(user);

  await tokenRepo().delete({ userId });
  return { message: 'Password changed successfully' };
}

export async function logout(userId: string, refreshToken?: string) {
  if (refreshToken) await tokenRepo().delete({ token: refreshToken });
  else await tokenRepo().delete({ userId });
}
