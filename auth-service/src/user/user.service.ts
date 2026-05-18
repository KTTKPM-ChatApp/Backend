import { AppDataSource, User, Friendship, FriendRequest } from '../db';

const userRepo = () => AppDataSource.getRepository(User);
const friendshipRepo = () => AppDataSource.getRepository(Friendship);
const friendReqRepo = () => AppDataSource.getRepository(FriendRequest);

const strip = ({ passwordHash: _, ...u }: User) => u;

export async function getById(id: string) {
  const user = await userRepo().findOneBy({ id });
  if (!user) throw new Error('User not found');
  return strip(user);
}

export async function search(q: string, limit = 20, offset = 0, currentUserId?: string) {
  const users = await userRepo()
    .createQueryBuilder('u')
    .where('u.display_name LIKE :q AND u.isActive = true', { q: `%${q}%` })
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
  // Chỉ update các trường được cung cấp
  // Cho phép avatarUrl null để xóa avatar
  
  // Xử lý dateOfBirth: nếu là string, chuyển thành Date
  const processedUpdates = { ...updates };
  if (updates.dateOfBirth && typeof updates.dateOfBirth === 'string') {
    processedUpdates.dateOfBirth = new Date(updates.dateOfBirth);
  }
  
  await userRepo().update(id, processedUpdates);
  return await getById(id);
}
