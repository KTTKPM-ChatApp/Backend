import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from './config';
import { ChatbotConversation } from './chatbot/chatbot-conversation.entity';
import { ChatbotMessage } from './chatbot/chatbot-message.entity';
import mysql from 'mysql2/promise';

export const AppDataSource = new DataSource({
  type: 'mariadb',
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,
  synchronize: true,
  logging: false,
  entities: [ChatbotConversation, ChatbotMessage],
});

export async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.username,
    password: config.db.password,
  });
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.end();
}
