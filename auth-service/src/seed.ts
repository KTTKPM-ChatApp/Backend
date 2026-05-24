import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AppDataSource, User, Friendship } from './db';
import { ensureDatabase, initializeDataSource } from './db';

const SAMPLE_USERS = [
  { username: 'nguyenvana', email: 'nguyenvana@example.com', displayName: 'Nguyen Van A', gender: 'male', bio: 'Sinh viên IUH', password: 'password123' },
  { username: 'tranthingb', email: 'tranthingb@example.com', displayName: 'Tran Thị B', gender: 'female', bio: 'Yêu thích công nghệ', password: 'password123' },
  { username: 'ledinhc', email: 'ledinhc@example.com', displayName: 'Lê Đình C', gender: 'male', bio: 'Developer', password: 'password123' },
  { username: 'phamthid', email: 'phamthid@example.com', displayName: 'Phạm Thị D', gender: 'female', bio: 'Designer', password: 'password123' },
  { username: 'hoangvuonge', email: 'hoangvuonge@example.com', displayName: 'Hoàng Vượng E', gender: 'male', bio: 'Backend Developer', password: 'password123' },
];

async function seed() {
  try {
    await ensureDatabase();
    await initializeDataSource();

    const userRepo = AppDataSource.getRepository(User);
    const friendshipRepo = AppDataSource.getRepository(Friendship);

    const createdUsers: User[] = [];

    for (const u of SAMPLE_USERS) {
      const existing = await userRepo.findOneBy({ email: u.email });
      if (existing) {
        console.log(`User ${u.email} already exists, skipping...`);
        createdUsers.push(existing);
        continue;
      }

      const user = userRepo.create({
        username: u.username,
        email: u.email,
        displayName: u.displayName,
        gender: u.gender,
        bio: u.bio,
        passwordHash: await bcrypt.hash(u.password, 10),
        isActive: true,
      });

      const saved = await userRepo.save(user);
      console.log(`Created user: ${u.email}`);
      createdUsers.push(saved);
    }

    for (let i = 0; i < createdUsers.length; i++) {
      for (let j = i + 1; j < createdUsers.length; j++) {
        const existing = await friendshipRepo.findOne({
          where: [
            { userId: createdUsers[i].id, friendId: createdUsers[j].id },
            { userId: createdUsers[j].id, friendId: createdUsers[i].id },
          ],
        });
        if (!existing) {
          await friendshipRepo.save({ userId: createdUsers[i].id, friendId: createdUsers[j].id });
          await friendshipRepo.save({ userId: createdUsers[j].id, friendId: createdUsers[i].id });
          console.log(`Friendship: ${createdUsers[i].displayName} <-> ${createdUsers[j].displayName}`);
        }
      }
    }

    const chatDbName = process.env.CHAT_DB_NAME || 'chat_service';
    const conn = await (await import('mysql2/promise')).createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
    });

    const [u1, u2, u3, u4, u5] = createdUsers;
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

    // ─── DIRECT conversation ────────────────────────────────────────────────
    const directKey = [u1.id, u2.id].sort().join(':');

    const [existingDirect] = await conn.execute(
      `SELECT id FROM \`${chatDbName}\`.conversations WHERE direct_key = ? LIMIT 1`,
      [directKey]
    ) as any;

    if ((existingDirect as any[]).length === 0) {
      const directConvId = randomUUID();

      const directMessages = [
        { content: 'Chào B, bạn khỏe không?', senderId: u1.id, createdAt: new Date(now.getTime() - 120000) },
        { content: 'Dạ em khỏe, cảm ơn anh A! Anh đang làm gì thế?', senderId: u2.id, createdAt: new Date(now.getTime() - 90000) },
        { content: 'Anh đang test tính năng chat. Em dùng thử giúp anh nhé.', senderId: u1.id, createdAt: new Date(now.getTime() - 60000) },
        { content: 'Vâng ạ! Giao diện đẹp lắm anh ơi 😊', senderId: u2.id, createdAt: new Date(now.getTime() - 30000) },
      ];

      const lastDirectMsg = directMessages[directMessages.length - 1];
      const lastDirectMsgId = randomUUID();

      await conn.execute(`
        INSERT INTO \`${chatDbName}\`.conversations (id, type, title, created_by, direct_key, last_message_id, last_message_preview, last_message_at, created_at, updated_at)
        VALUES (?, 'DIRECT', ?, ?, ?, ?, ?, ?, ?, ?)
      `, [directConvId, u2.displayName, u1.id, directKey, lastDirectMsgId, lastDirectMsg.content, fmt(lastDirectMsg.createdAt), fmt(now), fmt(now)]);

      await conn.execute(`
        INSERT INTO \`${chatDbName}\`.conversation_members (conversation_id, user_id, role, last_read_at, joined_at, created_at, updated_at)
        VALUES (?, ?, 'MEMBER', ?, ?, ?, ?)
      `, [directConvId, u1.id, fmt(now), fmt(now), fmt(now), fmt(now)]);
      await conn.execute(`
        INSERT INTO \`${chatDbName}\`.conversation_members (conversation_id, user_id, role, last_read_at, joined_at, created_at, updated_at)
        VALUES (?, ?, 'MEMBER', ?, ?, ?, ?)
      `, [directConvId, u2.id, fmt(now), fmt(now), fmt(now), fmt(now)]);

      for (const msg of directMessages) {
        const msgId = msg === lastDirectMsg ? lastDirectMsgId : randomUUID();
        await conn.execute(`
          INSERT INTO \`${chatDbName}\`.messages (id, conversation_id, sender_id, content_type, content, type, created_at, updated_at)
          VALUES (?, ?, ?, 'TEXT', ?, 'text', ?, ?)
        `, [msgId, directConvId, msg.senderId, msg.content, fmt(msg.createdAt), fmt(msg.createdAt)]);
      }

      console.log(`Created DIRECT conversation: ${u1.displayName} <-> ${u2.displayName}`);
    } else {
      console.log(`DIRECT conversation already exists, skipping...`);
    }

    // ─── GROUP conversation ────────────────────────────────────────────────
    const [existingGroup] = await conn.execute(
      `SELECT id FROM \`${chatDbName}\`.conversations WHERE type = 'GROUP' AND title = ? LIMIT 1`,
      ['IUH - Nhóm Chat']
    ) as any;

    if ((existingGroup as any[]).length === 0) {
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

      await conn.execute(`
        INSERT INTO \`${chatDbName}\`.conversations (id, type, title, created_by, last_message_id, last_message_preview, last_message_at, created_at, updated_at)
        VALUES (?, 'GROUP', ?, ?, ?, ?, ?, ?, ?)
      `, [groupConvId, 'IUH - Nhóm Chat', u1.id, lastGroupMsgId, lastGroupMsg.content, fmt(lastGroupMsg.createdAt), fmt(now), fmt(now)]);

      const allMembers = [u1, u2, u3, u4, u5];
      for (const m of allMembers) {
        const role = m.id === u1.id ? 'OWNER' : 'MEMBER';
        await conn.execute(`
          INSERT INTO \`${chatDbName}\`.conversation_members (conversation_id, user_id, role, last_read_at, joined_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [groupConvId, m.id, role, fmt(now), fmt(now), fmt(now), fmt(now)]);
      }

      for (const msg of groupMessages) {
        const msgId = msg === lastGroupMsg ? lastGroupMsgId : randomUUID();
        await conn.execute(`
          INSERT INTO \`${chatDbName}\`.messages (id, conversation_id, sender_id, content_type, content, type, created_at, updated_at)
          VALUES (?, ?, ?, 'TEXT', ?, 'text', ?, ?)
        `, [msgId, groupConvId, msg.senderId, msg.content, fmt(msg.createdAt), fmt(msg.createdAt)]);
      }

      console.log(`Created GROUP conversation: IUH - Nhóm Chat (5 members)`);
    } else {
      console.log(`GROUP conversation already exists, skipping...`);
    }

    await conn.end();
    console.log('Seed completed!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
