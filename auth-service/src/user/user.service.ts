import { AppDataSource, User } from '../db';

const repo = () => AppDataSource.getRepository(User);

const strip = ({ passwordHash: _, ...u }: User) => u;

export async function getById(id: string) {
  const user = await repo().findOneBy({ id });
  if (!user) throw new Error('User not found');
  return strip(user);
}

export async function search(q: string, limit = 20, offset = 0) {
  const users = await repo()
    .createQueryBuilder('u')
    .where('(u.username LIKE :q OR u.displayName LIKE :q) AND u.isActive = true', { q: `%${q}%` })
    .limit(limit).offset(offset)
    .getMany();
  return users.map(strip);
}
