import { createConnection } from 'mysql2/promise';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

async function getChatDbConnection() {
  return createConnection({
    host: process.env.CHAT_DB_HOST || 'mariadb-chat',
    port: Number(process.env.CHAT_DB_PORT) || 3306,
    user: process.env.CHAT_DB_USER || 'root',
    password: config.db.password,
    database: process.env.CHAT_DB_NAME || 'chat_service',
  });
}

// Connect dynamically to the auth_service database on port 3306 (mariadb container)
async function getAuthDbConnection() {
  return createConnection({
    host: 'mariadb',
    port: 3306,
    user: 'root',
    password: config.db.password,
    database: 'auth_service',
  });
}

// 1. Basic Stats
export async function queryRecentChats(limit = 5) {
  const conn = await getChatDbConnection();
  try {
    const [rows]: any = await conn.execute(
      `SELECT m.content, m.created_at as createdAt, u.display_name as senderName, c.title as conversationTitle
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       LEFT JOIN conversations c ON m.conversation_id = c.id
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  } finally {
    await conn.end();
  }
}

export async function queryTopChatters(limit = 5) {
  const conn = await getChatDbConnection();
  try {
    const [rows]: any = await conn.execute(
      `SELECT u.display_name as displayName, COUNT(m.id) as messageCount
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       GROUP BY m.sender_id, u.display_name
       ORDER BY messageCount DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  } finally {
    await conn.end();
  }
}

export async function querySystemStats() {
  const conn = await getChatDbConnection();
  try {
    const [[usersResult]]: any = await conn.execute('SELECT COUNT(*) as count FROM users');
    const [[messagesResult]]: any = await conn.execute('SELECT COUNT(*) as count FROM messages');
    const [[convsResult]]: any = await conn.execute('SELECT COUNT(*) as count FROM conversations');
    return {
      totalUsers: usersResult.count,
      totalMessages: messagesResult.count,
      totalConversations: convsResult.count,
    };
  } finally {
    await conn.end();
  }
}

// 2. Advanced Tools

// Search for detailed user profiles by display name or email
export async function queryUserInfo(searchQuery: string) {
  const conn = await getChatDbConnection();
  try {
    const [rows]: any = await conn.execute(
      `SELECT display_name as displayName, email, bio, gender, phone, is_active as isActive, created_at as createdAt
       FROM users
       WHERE display_name LIKE ? OR email LIKE ? OR username LIKE ?
       LIMIT 3`,
      [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`]
    );
    return rows;
  } finally {
    await conn.end();
  }
}

// List top active chat groups by member count
export async function queryActiveGroups(limit = 5) {
  const conn = await getChatDbConnection();
  try {
    const [rows]: any = await conn.execute(
      `SELECT c.title, c.description, COUNT(cm.user_id) as memberCount, c.last_message_preview as lastMessagePreview
       FROM conversations c
       JOIN conversation_members cm ON c.id = cm.conversation_id
       WHERE c.type = 'GROUP'
       GROUP BY c.id, c.title, c.description, c.last_message_preview
       ORDER BY memberCount DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  } finally {
    await conn.end();
  }
}

// Get recently pinned messages in any conversation
export async function queryPinnedMessages(limit = 5) {
  const conn = await getChatDbConnection();
  try {
    const [rows]: any = await conn.execute(
      `SELECT m.content, mp.pinned_at as pinnedAt, u_pinned.display_name as pinnedBy, u_sender.display_name as messageSender, c.title as conversationTitle
       FROM message_pins mp
       JOIN messages m ON mp.message_id = m.id
       JOIN users u_pinned ON mp.pinned_by = u_pinned.id
       JOIN users u_sender ON m.sender_id = u_sender.id
       LEFT JOIN conversations c ON mp.conversation_id = c.id
       ORDER BY mp.pinned_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows;
  } finally {
    await conn.end();
  }
}

// Get the most popular reaction emojis used
export async function queryTopEmojis() {
  const conn = await getChatDbConnection();
  try {
    const [rows]: any = await conn.execute(
      `SELECT emoji, COUNT(id) as count
       FROM message_reactions
       GROUP BY emoji
       ORDER BY count DESC
       LIMIT 10`
    );
    return rows;
  } finally {
    await conn.end();
  }
}

// 3. Agentic Mutations

// Create a file in cloud
export async function createCloudFile(userId: string, name: string, url: string, mimeType: string, size: number, folderId?: string | null) {
  const conn = await getChatDbConnection();
  try {
    const fileId = uuidv4();
    await conn.execute(
      `INSERT INTO cloud_files (id, name, url, mime_type, size, folder_id, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [fileId, name, url, mimeType, size, folderId || null, userId]
    );
    return { success: true, fileId };
  } finally {
    await conn.end();
  }
}

// Delete a file in cloud
export async function deleteCloudFile(userId: string, fileId: string) {
  const conn = await getChatDbConnection();
  try {
    await conn.execute('DELETE FROM cloud_files WHERE id = ? AND user_id = ?', [fileId, userId]);
    return { success: true };
  } finally {
    await conn.end();
  }
}

// List cloud files for the current user (optionally filter by folder name)
export async function listCloudFiles(userId: string, folderName?: string | null) {
  const conn = await getChatDbConnection();
  try {
    let query = '';
    let params: any[] = [];
    if (folderName) {
      query = `SELECT cf.id, cf.name, cf.mime_type as mimeType, cf.size, cf.created_at as createdAt, cfo.name as folderName
               FROM cloud_files cf
               LEFT JOIN cloud_folders cfo ON cf.folder_id = cfo.id
               WHERE cf.user_id = ? AND cfo.name LIKE ?
               ORDER BY cf.created_at DESC`;
      params = [userId, `%${folderName}%`];
    } else {
      query = `SELECT cf.id, cf.name, cf.mime_type as mimeType, cf.size, cf.created_at as createdAt, cfo.name as folderName
               FROM cloud_files cf
               LEFT JOIN cloud_folders cfo ON cf.folder_id = cfo.id
               WHERE cf.user_id = ?
               ORDER BY cf.created_at DESC
               LIMIT 50`;
      params = [userId];
    }
    const [rows]: any = await conn.execute(query, params);
    return rows;
  } finally {
    await conn.end();
  }
}

// Delete a cloud file by name (optionally scoped to a folder name)
export async function deleteCloudFileByName(userId: string, fileName: string, folderName?: string | null) {
  const conn = await getChatDbConnection();
  try {
    let rows: any[];
    if (folderName) {
      [rows] = await conn.execute(
        `SELECT cf.id, cf.name, cfo.name as folderName FROM cloud_files cf
         LEFT JOIN cloud_folders cfo ON cf.folder_id = cfo.id
         WHERE cf.user_id = ? AND cf.name LIKE ? AND cfo.name LIKE ?`,
        [userId, `%${fileName}%`, `%${folderName}%`]
      ) as any;
    } else {
      [rows] = await conn.execute(
        `SELECT cf.id, cf.name, cfo.name as folderName FROM cloud_files cf
         LEFT JOIN cloud_folders cfo ON cf.folder_id = cfo.id
         WHERE cf.user_id = ? AND cf.name LIKE ?`,
        [userId, `%${fileName}%`]
      ) as any;
    }
    if (rows.length === 0) return { success: false, message: `File "${fileName}" not found.` };
    if (rows.length > 1) {
      return {
        success: false,
        requiresChoice: true,
        message: `Multiple files match the name "${fileName}". Please specify which folder.`,
        files: rows.map(r => ({ name: r.name, folderName: r.folderName || 'Root' }))
      };
    }
    const fileId = rows[0].id;
    await conn.execute('DELETE FROM cloud_files WHERE id = ? AND user_id = ?', [fileId, userId]);
    return { success: true, deletedFileId: fileId };
  } finally {
    await conn.end();
  }
}

// List friends of current user
export async function queryFriendsList(userId: string) {
  const conn = await getChatDbConnection();
  try {
    const [rows]: any = await conn.execute(
      `SELECT u.id, u.display_name as displayName, u.email
       FROM friendships f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = ?`,
      [userId]
    );
    return rows;
  } finally {
    await conn.end();
  }
}

// Send friend request (modifies auth_service database)
export async function addFriendRequest(senderId: string, searchCriteria: string) {
  const authConn = await getAuthDbConnection();
  try {
    const [users]: any = await authConn.execute(
      'SELECT id, display_name FROM users WHERE email = ? OR username = ? OR display_name = ?',
      [searchCriteria, searchCriteria, searchCriteria]
    );
    if (users.length === 0) return { success: false, message: 'User not found' };
    const receiver = users[0];

    // Check if request already exists
    const [exist]: any = await authConn.execute(
      'SELECT id FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = "pending"',
      [senderId, receiver.id]
    );
    if (exist.length > 0) return { success: false, message: 'Friend request already pending' };

    const requestId = uuidv4();
    await authConn.execute(
      `INSERT INTO friend_requests (id, sender_id, receiver_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', NOW(), NOW())`,
      [requestId, senderId, receiver.id]
    );
    return { success: true, message: `Sent friend request to ${receiver.display_name}` };
  } finally {
    await authConn.end();
  }
}

// Remove friend
export async function removeFriendConnection(userId: string, friendId: string) {
  const authConn = await getAuthDbConnection();
  try {
    await authConn.execute(
      'DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [userId, friendId, friendId, userId]
    );
    return { success: true };
  } finally {
    await authConn.end();
  }
}
