import { AppDataSource, FriendRequest, Friendship, Block, User } from '../db';
import { In, Not } from 'typeorm';

const friendReqRepo = () => AppDataSource.getRepository(FriendRequest);
const friendshipRepo = () => AppDataSource.getRepository(Friendship);
const blockRepo = () => AppDataSource.getRepository(Block);
const userRepo = () => AppDataSource.getRepository(User);

/* ───── Friend Request ───── */

export async function sendRequest(senderId: string, receiverId: string, message?: string) {
  if (senderId === receiverId) throw new Error('Cannot send request to yourself');

  const existing = await friendReqRepo().findOne({
    where: [
      { senderId, receiverId, status: 'pending' },
      { senderId: receiverId, receiverId: senderId, status: 'pending' },
    ],
  });
  if (existing) throw new Error(existing.senderId === senderId ? 'Request already sent' : 'User already sent you a request');

  const areFriends = await friendshipRepo().findOne({
    where: [
      { userId: senderId, friendId: receiverId },
      { userId: receiverId, friendId: senderId },
    ],
  });
  if (areFriends) throw new Error('Already friends');

  const blocked = await blockRepo().findOne({
    where: [
      { blockerId: senderId, blockedId: receiverId },
      { blockerId: receiverId, blockedId: senderId },
    ],
  });
  if (blocked) throw new Error('Cannot send request');

  return friendReqRepo().save({ senderId, receiverId, requestMessage: message, status: 'pending' });
}

export async function respondToRequest(requestId: string, userId: string, action: 'accepted' | 'rejected') {
  const req = await friendReqRepo().findOneBy({ id: requestId });
  if (!req) throw new Error('Request not found');
  if (req.receiverId !== userId) throw new Error('Not your request');
  if (req.status !== 'pending') throw new Error('Request already processed');

  await friendReqRepo().update(requestId, { status: action });

  if (action === 'accepted') {
    const friendId1 = req.senderId;
    const friendId2 = req.receiverId;
    await friendshipRepo().save({ userId: friendId1, friendId: friendId2 });
    await friendshipRepo().save({ userId: friendId2, friendId: friendId1 });
  }

  return { id: requestId, status: action };
}

export async function cancelRequest(requestId: string, userId: string) {
  const req = await friendReqRepo().findOneBy({ id: requestId });
  if (!req) throw new Error('Request not found');
  if (req.senderId !== userId) throw new Error('Not your request');
  if (req.status !== 'pending') throw new Error('Request already processed');

  await friendReqRepo().update(requestId, { status: 'cancelled' });
  return { id: requestId, status: 'cancelled' };
}

/* ───── List queries ───── */

export async function getFriends(userId: string) {
  const friendships = await friendshipRepo().find({ where: { userId }, relations: [] });
  if (!friendships.length) return [];

  const friendIds = friendships.map(f => f.friendId);
  const users = await userRepo().find({ where: { id: In(friendIds), isActive: true } });
  return users.map(u => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    phone: u.phone,
    friendshipStatus: 'friend' as const,
  }));
}

export async function getPendingRequests(userId: string) {
  const requests = await friendReqRepo().find({
    where: { receiverId: userId, status: 'pending' },
    order: { createdAt: 'DESC' },
  });
  if (!requests.length) return [];

  const senderIds = requests.map(r => r.senderId);
  const users = await userRepo().find({ where: { id: In(senderIds) } });
  const userMap = new Map(users.map(u => [u.id, u]));

  return requests.map(r => {
    const sender = userMap.get(r.senderId);
    return {
      id: r.id,
      requestId: r.id,
      senderId: r.senderId,
      sender: sender ? { id: sender.id, displayName: sender.displayName, avatarUrl: sender.avatarUrl } : null,
      message: r.requestMessage,
      status: r.status,
      createdAt: r.createdAt,
    };
  });
}

export async function getSentRequests(userId: string) {
  const requests = await friendReqRepo().find({
    where: { senderId: userId, status: 'pending' },
    order: { createdAt: 'DESC' },
  });
  if (!requests.length) return [];

  const receiverIds = requests.map(r => r.receiverId);
  const users = await userRepo().find({ where: { id: In(receiverIds) } });
  const userMap = new Map(users.map(u => [u.id, u]));

  return requests.map(r => {
    const receiver = userMap.get(r.receiverId);
    return {
      id: r.id,
      requestId: r.id,
      receiverId: r.receiverId,
      receiver: receiver ? { id: receiver.id, displayName: receiver.displayName, avatarUrl: receiver.avatarUrl } : null,
      status: r.status,
      createdAt: r.createdAt,
    };
  });
}

/* ───── Remove / Block ───── */

export async function removeFriend(userId: string, friendId: string) {
  await friendshipRepo().delete({ userId, friendId });
  await friendshipRepo().delete({ userId: friendId, friendId: userId });
  return { success: true };
}

export async function blockUser(blockerId: string, blockedId: string, reason?: string) {
  const existing = await blockRepo().findOne({ where: { blockerId, blockedId } });
  if (existing) {
    return { success: true, message: 'Already blocked' };
  }
  await removeFriend(blockerId, blockedId);
  await blockRepo().save({ blockerId, blockedId, reason });
  return { success: true };
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await blockRepo().delete({ blockerId, blockedId });
  return { success: true };
}

/* ───── Friendship status helper ───── */

export async function getFriendshipStatus(userId: string, targetId: string): Promise<'none' | 'friend' | 'pending' | string> {
  const isFriend = await friendshipRepo().findOne({
    where: [
      { userId, friendId: targetId },
      { userId: targetId, friendId: userId },
    ],
  });
  if (isFriend) return 'friend';

  const pendingReq = await friendReqRepo().findOne({
    where: [
      { senderId: userId, receiverId: targetId, status: 'pending' },
      { senderId: targetId, receiverId: userId, status: 'pending' },
    ],
  });
  if (pendingReq) return 'pending';

  return 'none';
}
