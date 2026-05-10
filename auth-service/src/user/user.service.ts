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
    .where('(u.username LIKE :q OR u.displayName LIKE :q OR u.email LIKE :q) AND u.isActive = true', { q: `%${q}%` })
    .limit(limit).offset(offset)
    .getMany();
  return users.map(strip);
}

export async function updateById(id: string, updates: Partial<User>) {
  // Chỉ update các trường được cung cấp
  // Cho phép avatarUrl null để xóa avatar
  
  // Xử lý dateOfBirth: nếu là string, chuyển thành Date
  const processedUpdates = { ...updates };
  if (updates.dateOfBirth && typeof updates.dateOfBirth === 'string') {
    processedUpdates.dateOfBirth = new Date(updates.dateOfBirth);
  }
  
  await repo().update(id, processedUpdates);
  return await getById(id);
}
