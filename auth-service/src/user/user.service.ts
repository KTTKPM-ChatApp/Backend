import { AppDataSource, User, Friendship, FriendRequest } from '../db';
import { publishUserUpdated } from '../rabbitmq';

const userRepo = () => AppDataSource.getRepository(User);
const friendshipRepo = () => AppDataSource.getRepository(Friendship);
const friendReqRepo = () => AppDataSource.getRepository(FriendRequest);

const strip = ({ passwordHash: _, ...u }: User) => u;

export async function getById(id: string) {
  const user = await userRepo().findOneBy({ id });
  if (!user) throw new Error('User not found');
  return strip(user);
}

export async function getByIds(ids: string[]) {
  if (!ids.length) return [];
  const users = await userRepo()
    .createQueryBuilder('u')
    .where('u.id IN (:...ids)', { ids })
    .getMany();
  return users.map(strip);
}

export async function getAll() {
  const users = await userRepo().find({ where: { isActive: true } });
  return users.map(strip);
}

export async function search(q: string, limit = 20, offset = 0, currentUserId?: string) {
  const users = await userRepo()
    .createQueryBuilder('u')
    .where('(u.display_name LIKE :q OR u.username LIKE :q OR u.email LIKE :q) AND u.is_active = true', { q: `%${q}%` })
    .limit(limit).offset(offset)
    .getMany();

  if (!currentUserId) return users.map(strip);

  const friendIds = (await friendshipRepo().find({
    where: [{ userId: currentUserId }, { friendId: currentUserId }],
  })).flatMap(f => [f.userId === currentUserId ? f.friendId : f.userId]);

  const friendSet = new Set(friendIds);

  const pendingReqs = await friendReqRepo().find({
    where: [
      { senderId: currentUserId, status: 'pending' },
      { receiverId: currentUserId, status: 'pending' },
    ],
  });
  const sentPending = new Set(pendingReqs.filter(r => r.senderId === currentUserId).map(r => r.receiverId));
  const recvPending = new Set(pendingReqs.filter(r => r.receiverId === currentUserId).map(r => r.senderId));

  return users.map(u => {
    const user = strip(u);
    let friendshipStatus: string = 'none';
    if (friendSet.has(u.id)) friendshipStatus = 'friend';
    else if (sentPending.has(u.id)) friendshipStatus = 'outgoing';
    else if (recvPending.has(u.id)) friendshipStatus = 'incoming';
    return { ...user, friendshipStatus };
  });
}

export async function updateById(id: string, updates: Partial<User>) {
  const processedUpdates = { ...updates };
  if (updates.dateOfBirth && typeof updates.dateOfBirth === 'string') {
    processedUpdates.dateOfBirth = new Date(updates.dateOfBirth);
  }

  await userRepo().update(id, processedUpdates);

  publishUserUpdated(id, {
    id,
    username: processedUpdates.username,
    displayName: processedUpdates.displayName,
    avatarUrl: processedUpdates.avatarUrl,
    email: processedUpdates.email,
    isActive: processedUpdates.isActive,
    bio: processedUpdates.bio,
    gender: processedUpdates.gender,
    phone: processedUpdates.phone,
  }).catch(() => {});

  return await getById(id);
}
