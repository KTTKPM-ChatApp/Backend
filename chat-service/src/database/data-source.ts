import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { ConversationMemberOrmEntity } from '../chat/infrastructure/persistence/typeorm/entities/conversation-member.orm-entity';
import { ConversationOrmEntity } from '../chat/infrastructure/persistence/typeorm/entities/conversation.orm-entity';
import { MessageOrmEntity } from '../chat/infrastructure/persistence/typeorm/entities/message.orm-entity';
import { OutboxEventOrmEntity } from '../chat/infrastructure/persistence/typeorm/entities/outbox-event.orm-entity';
import { CreateChatSchema1710000000000 } from './migrations/1710000000000-create-chat-schema';

dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  database: process.env.DATABASE_NAME ?? 'chat_service',
  ssl: process.env.DATABASE_SSL === 'true',
  entities: [
    ConversationOrmEntity,
    ConversationMemberOrmEntity,
    MessageOrmEntity,
    OutboxEventOrmEntity,
  ],
  migrations: [CreateChatSchema1710000000000],
});

