const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

const dbHost = process.env.DB_HOST || "127.0.0.1";
const dbPort = Number(process.env.DB_PORT || 3306);
const dbUser = process.env.DB_USER || "root";
const dbPass = process.env.DB_PASS || process.env.MYSQL_ROOT_PASSWORD || "sapassword";

const users = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    username: "alice",
    email: "alice@test.local",
    displayName: "Alice Nguyen",
    avatarUrl: "https://i.pravatar.cc/150?u=alice",
    bio: "Frontend tester",
    gender: "female",
    phone: "0900000001",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    username: "bob",
    email: "bob@test.local",
    displayName: "Bob Tran",
    avatarUrl: "https://i.pravatar.cc/150?u=bob",
    bio: "Realtime tester",
    gender: "male",
    phone: "0900000002",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    username: "charlie",
    email: "charlie@test.local",
    displayName: "Charlie Le",
    avatarUrl: "https://i.pravatar.cc/150?u=charlie",
    bio: "Group chat tester",
    gender: "male",
    phone: "0900000003",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    username: "diana",
    email: "diana@test.local",
    displayName: "Diana Pham",
    avatarUrl: "https://i.pravatar.cc/150?u=diana",
    bio: "Friend request tester",
    gender: "female",
    phone: "0900000004",
  },
];

const conversations = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    type: "DIRECT",
    title: "Bob Tran",
    createdBy: users[0].id,
    directKey: [users[0].id, users[1].id].sort().join(":"),
    members: [
      { userId: users[0].id, role: "MEMBER" },
      { userId: users[1].id, role: "MEMBER" },
    ],
    messages: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001",
        senderId: users[0].id,
        content: "Bob oi, test realtime giup minh nhe.",
        createdAt: "2026-05-23 09:00:00",
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002",
        senderId: users[1].id,
        content: "Ok Alice, minh dang online.",
        createdAt: "2026-05-23 09:01:00",
      },
    ],
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    type: "GROUP",
    title: "IUH Chat Test",
    createdBy: users[0].id,
    directKey: null,
    members: [
      { userId: users[0].id, role: "OWNER" },
      { userId: users[1].id, role: "MEMBER" },
      { userId: users[2].id, role: "MEMBER" },
    ],
    messages: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb003",
        senderId: users[2].id,
        content: "Chao moi nguoi, day la group mau.",
        createdAt: "2026-05-23 09:05:00",
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb004",
        senderId: users[0].id,
        content: "Group nay dung de test unread, realtime va danh sach chat.",
        createdAt: "2026-05-23 09:06:00",
      },
    ],
  },
];

async function ensureSchemas(conn) {
  await conn.query("CREATE DATABASE IF NOT EXISTS auth_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  await conn.query("CREATE DATABASE IF NOT EXISTS chat_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

  await conn.query(`
    CREATE TABLE IF NOT EXISTS auth_service.users (
      id varchar(36) PRIMARY KEY,
      username varchar(255) UNIQUE NOT NULL,
      email varchar(255) UNIQUE NOT NULL,
      password_hash varchar(255) NOT NULL,
      display_name varchar(255) NOT NULL,
      avatar_url varchar(500) NULL,
      bio varchar(255) NULL,
      gender varchar(255) NULL,
      date_of_birth date NULL,
      phone varchar(255) NULL,
      is_active tinyint(1) NOT NULL DEFAULT 1,
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS auth_service.friendships (
      id varchar(36) PRIMARY KEY,
      user_id varchar(255) NOT NULL,
      friend_id varchar(255) NOT NULL,
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS auth_service.friend_requests (
      id varchar(36) PRIMARY KEY,
      sender_id varchar(255) NOT NULL,
      receiver_id varchar(255) NOT NULL,
      request_message text NULL,
      status varchar(255) NOT NULL DEFAULT 'pending',
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS chat_service.conversations (
      id varchar(36) PRIMARY KEY,
      type varchar(16) NOT NULL,
      title varchar(255) NULL,
      created_by varchar(36) NOT NULL,
      direct_key varchar(255) NULL,
      avatar_url varchar(500) NULL,
      description varchar(500) NULL,
      last_message_id varchar(36) NULL,
      last_message_preview text NULL,
      last_message_at datetime NULL,
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_direct_key (direct_key)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS chat_service.conversation_members (
      conversation_id varchar(36) NOT NULL,
      user_id varchar(36) NOT NULL,
      role varchar(20) NOT NULL DEFAULT 'MEMBER',
      nickname varchar(100) NULL,
      is_muted tinyint(1) NOT NULL DEFAULT 0,
      last_read_at datetime NULL,
      joined_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (conversation_id, user_id)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS chat_service.messages (
      id varchar(36) PRIMARY KEY,
      conversation_id varchar(36) NOT NULL,
      sender_id varchar(36) NOT NULL,
      content_type varchar(32) NOT NULL,
      content text NOT NULL,
      attachments json NULL,
      reply_to_id varchar(36) NULL,
      is_edited tinyint(1) NOT NULL DEFAULT 0,
      edited_at datetime NULL,
      created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      type varchar(20) NOT NULL DEFAULT 'text',
      message_type varchar(20) NULL,
      system_event_type varchar(50) NULL,
      metadata json NULL
    )
  `);
}

async function seedUsers(conn) {
  const passwordHash = await bcrypt.hash("Password123!", 10);
  for (const user of users) {
    await conn.query(
      `
      INSERT INTO auth_service.users
        (id, username, email, password_hash, display_name, avatar_url, bio, gender, phone, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        username = VALUES(username),
        email = VALUES(email),
        password_hash = VALUES(password_hash),
        display_name = VALUES(display_name),
        avatar_url = VALUES(avatar_url),
        bio = VALUES(bio),
        gender = VALUES(gender),
        phone = VALUES(phone),
        is_active = 1
      `,
      [
        user.id,
        user.username,
        user.email,
        passwordHash,
        user.displayName,
        user.avatarUrl,
        user.bio,
        user.gender,
        user.phone,
      ],
    );
  }
}

async function seedFriends(conn) {
  const friendships = [
    ["f1111111-1111-4111-8111-111111111111", users[0].id, users[1].id],
    ["f2222222-2222-4222-8222-222222222222", users[1].id, users[0].id],
    ["f3333333-3333-4333-8333-333333333333", users[0].id, users[2].id],
    ["f4444444-4444-4444-8444-444444444444", users[2].id, users[0].id],
  ];

  for (const [id, userId, friendId] of friendships) {
    await conn.query(
      `
      INSERT INTO auth_service.friendships (id, user_id, friend_id)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), friend_id = VALUES(friend_id)
      `,
      [id, userId, friendId],
    );
  }

  await conn.query(
    `
    INSERT INTO auth_service.friend_requests
      (id, sender_id, receiver_id, request_message, status)
    VALUES (?, ?, ?, ?, 'pending')
    ON DUPLICATE KEY UPDATE
      sender_id = VALUES(sender_id),
      receiver_id = VALUES(receiver_id),
      request_message = VALUES(request_message),
      status = 'pending'
    `,
    [
      "f5555555-5555-4555-8555-555555555555",
      users[3].id,
      users[0].id,
      "Minh la Diana, ket ban test nhe.",
    ],
  );
}

async function seedConversations(conn) {
  for (const conversation of conversations) {
    const lastMessage = conversation.messages.at(-1);
    await conn.query(
      `
      INSERT INTO chat_service.conversations
        (id, type, title, created_by, direct_key, last_message_id, last_message_preview, last_message_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        type = VALUES(type),
        title = VALUES(title),
        created_by = VALUES(created_by),
        direct_key = VALUES(direct_key),
        last_message_id = VALUES(last_message_id),
        last_message_preview = VALUES(last_message_preview),
        last_message_at = VALUES(last_message_at)
      `,
      [
        conversation.id,
        conversation.type,
        conversation.title,
        conversation.createdBy,
        conversation.directKey,
        lastMessage.id,
        lastMessage.content,
        lastMessage.createdAt,
      ],
    );

    for (const member of conversation.members) {
      await conn.query(
        `
        INSERT INTO chat_service.conversation_members
          (conversation_id, user_id, role, last_read_at)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          role = VALUES(role),
          last_read_at = VALUES(last_read_at)
        `,
        [conversation.id, member.userId, member.role, "2026-05-23 09:10:00"],
      );
    }

    for (const message of conversation.messages) {
      await conn.query(
        `
        INSERT INTO chat_service.messages
          (id, conversation_id, sender_id, content_type, content, created_at, updated_at, type)
        VALUES (?, ?, ?, 'TEXT', ?, ?, ?, 'text')
        ON DUPLICATE KEY UPDATE
          conversation_id = VALUES(conversation_id),
          sender_id = VALUES(sender_id),
          content = VALUES(content),
          created_at = VALUES(created_at),
          updated_at = VALUES(updated_at)
        `,
        [
          message.id,
          conversation.id,
          message.senderId,
          message.content,
          message.createdAt,
          message.createdAt,
        ],
      );
    }
  }
}

async function main() {
  const conn = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPass,
    multipleStatements: false,
  });

  try {
    await ensureSchemas(conn);
    await seedUsers(conn);
    await seedFriends(conn);
    await seedConversations(conn);
    console.log("Sample data seeded.");
    console.log("Accounts:");
    for (const user of users) {
      console.log(`- ${user.email} / Password123!`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error("Failed to seed sample data:", error);
  process.exit(1);
});
