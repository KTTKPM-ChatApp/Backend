import 'reflect-metadata';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { AppDataSource, ensureDatabase, Conversation, ConversationMember, Message } from './db';

interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

async function fetchUsers(): Promise<AuthUser[]> {
  const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
  try {
    // Fetch all users individually via known IDs
    // In production, use the /users/batch endpoint
    const res = await axios.get(`${authUrl}/users/search?q=a&limit=100`, {
      timeout: 5000,
      headers: { accept: 'application/json' },
    });
    return res.data?.data || [];
  } catch {
    // Fallback: return mock users matching auth-service seed.ts
    return [
      { id: '00000000-0000-0000-0000-000000000001', username: 'nguyenvana', displayName: 'Nguyen Van A' },
      { id: '00000000-0000-0000-0000-000000000002', username: 'tranthingb', displayName: 'Tran Thị B' },
      { id: '00000000-0000-0000-0000-000000000003', username: 'ledinhc', displayName: 'Lê Đình C' },
      { id: '00000000-0000-0000-0000-000000000004', username: 'phamthid', displayName: 'Phạm Thị D' },
      { id: '00000000-0000-0000-0000-000000000005', username: 'hoangvuonge', displayName: 'Hoàng Vượng E' },
    ];
  }
}

async function seed() {
  try {
    await ensureDatabase();
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    console.log('[Seed] Database ready');

    const conversationRepo = AppDataSource.getRepository(Conversation);
    const memberRepo = AppDataSource.getRepository(ConversationMember);
    const messageRepo = AppDataSource.getRepository(Message);

    const users = await fetchUsers();
    const [u1, u2, u3, u4, u5] = users;
    if (!u1 || !u2) {
      console.log('[Seed] Not enough users, skipping chat seed');
      process.exit(0);
    }

    const now = new Date();

    // ─── DIRECT conversation ────────────────────────────────────────────────
    const directKey = [u1.id, u2.id].sort().join(':');
    const existingDirect = await conversationRepo.findOneBy({ directKey });

    if (!existingDirect) {
      const directConvId = randomUUID();
      const directMessages = [
        { content: 'Chào B, bạn khỏe không?', senderId: u1.id, createdAt: new Date(now.getTime() - 120000) },
        { content: 'Dạ em khỏe, cảm ơn anh A! Anh đang làm gì thế?', senderId: u2.id, createdAt: new Date(now.getTime() - 90000) },
        { content: 'Anh đang test tính năng chat. Em dùng thử giúp anh nhé.', senderId: u1.id, createdAt: new Date(now.getTime() - 60000) },
        { content: 'Vâng ạ! Giao diện đẹp lắm anh ơi 😊', senderId: u2.id, createdAt: new Date(now.getTime() - 30000) },
      ];
      const lastDirectMsg = directMessages[directMessages.length - 1];
      const lastDirectMsgId = randomUUID();

      await conversationRepo.save(conversationRepo.create({
        id: directConvId,
        type: 'DIRECT',
        title: u2.displayName,
        createdBy: u1.id,
        directKey,
        lastMessageId: lastDirectMsgId,
        lastMessagePreview: lastDirectMsg.content.slice(0, 255),
        lastMessageAt: lastDirectMsg.createdAt,
        createdAt: now,
        updatedAt: now,
      }));

      await memberRepo.save([
        memberRepo.create({ conversationId: directConvId, userId: u1.id, role: 'MEMBER', lastReadAt: now, joinedAt: now }),
        memberRepo.create({ conversationId: directConvId, userId: u2.id, role: 'MEMBER', lastReadAt: now, joinedAt: now }),
      ]);

      for (const msg of directMessages) {
        const msgId = msg === lastDirectMsg ? lastDirectMsgId : randomUUID();
        await messageRepo.save(messageRepo.create({
          id: msgId,
          conversationId: directConvId,
          senderId: msg.senderId,
          contentType: 'TEXT',
          content: msg.content,
          type: 'text',
          createdAt: msg.createdAt,
          updatedAt: msg.createdAt,
        }));
      }

      console.log(`[Seed] DIRECT conversation: ${u1.displayName} <-> ${u2.displayName}`);
    } else {
      console.log('[Seed] DIRECT conversation already exists, skipping');
    }

    // ─── GROUP conversation ────────────────────────────────────────────────
    const existingGroup = await conversationRepo.findOneBy({ type: 'GROUP', title: 'IUH - Nhóm Chat' });

    if (!existingGroup && u1 && u3 && u4 && u5) {
      const groupConvId = randomUUID();
      const groupMessages = [
        { content: 'Chào mọi người! Đây là nhóm chat IUH.', senderId: u1.id, createdAt: new Date(now.getTime() - 360000) },
        { content: 'Chào anh A! Em là thành viên mới 😄', senderId: u3.id, createdAt: new Date(now.getTime() - 330000) },
        { content: 'Nhóm mình có bao nhiêu người vậy ạ?', senderId: u4.id, createdAt: new Date(now.getTime() - 300000) },
        { content: 'Hiện tại có 5 người: A, B, C, D, E', senderId: u2.id, createdAt: new Date(now.getTime() - 270000) },
        { content: 'Mọi người đã test tính năng gì chưa?', senderId: u5.id, createdAt: new Date(now.getTime() - 240000) },
        { content: 'Mình test nhắn tin nhóm rồi, hoạt động tốt!', senderId: u3.id, createdAt: new Date(now.getTime() - 210000) },
        { content: 'Còn tính năng gọi video thì sao?', senderId: u4.id, createdAt: new Date(now.getTime() - 180000) },
        { content: 'Đang phát triển thêm, sẽ sớm có bản update!', senderId: u1.id, createdAt: new Date(now.getTime() - 150000) },
        { content: 'Em thấy UI đẹp lắm, đúng chuẩn Zalo luôn 👍', senderId: u5.id, createdAt: new Date(now.getTime() - 120000) },
        { content: 'Cảm ơn mọi người! Cùng cố gắng hoàn thiện nhé!', senderId: u1.id, createdAt: new Date(now.getTime() - 90000) },
      ];
      const lastGroupMsg = groupMessages[groupMessages.length - 1];
      const lastGroupMsgId = randomUUID();

      await conversationRepo.save(conversationRepo.create({
        id: groupConvId,
        type: 'GROUP',
        title: 'IUH - Nhóm Chat',
        createdBy: u1.id,
        lastMessageId: lastGroupMsgId,
        lastMessagePreview: lastGroupMsg.content.slice(0, 255),
        lastMessageAt: lastGroupMsg.createdAt,
        createdAt: now,
        updatedAt: now,
      }));

      const allMembers = [u1, u2, u3, u4, u5];
      await memberRepo.save(allMembers.map(m =>
        memberRepo.create({
          conversationId: groupConvId,
          userId: m.id,
          role: m.id === u1.id ? 'OWNER' : 'MEMBER',
          lastReadAt: now,
          joinedAt: now,
        })
      ));

      for (const msg of groupMessages) {
        const msgId = msg === lastGroupMsg ? lastGroupMsgId : randomUUID();
        await messageRepo.save(messageRepo.create({
          id: msgId,
          conversationId: groupConvId,
          senderId: msg.senderId,
          contentType: 'TEXT',
          content: msg.content,
          type: 'text',
          createdAt: msg.createdAt,
          updatedAt: msg.createdAt,
        }));
      }

      console.log('[Seed] GROUP conversation: IUH - Nhóm Chat (5 members)');
    } else {
      console.log('[Seed] GROUP conversation already exists or missing users, skipping');
    }

    console.log('[Seed] Chat seed completed!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Failed:', error);
    process.exit(1);
  }
}

seed();
