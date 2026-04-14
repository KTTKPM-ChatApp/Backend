import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { ConversationMemberOrmEntity } from '../chat/infrastructure/persistence/typeorm/entities/conversation-member.orm-entity';
import { ConversationOrmEntity } from '../chat/infrastructure/persistence/typeorm/entities/conversation.orm-entity';
import { MessageOrmEntity } from '../chat/infrastructure/persistence/typeorm/entities/message.orm-entity';
import { MessageReadReceiptOrmEntity } from '../chat/infrastructure/persistence/typeorm/entities/message-read-receipt.orm-entity';
import { MessageReactionOrmEntity } from '../chat/infrastructure/persistence/typeorm/entities/message-reaction.orm-entity';
import { OutboxEventOrmEntity } from '../chat/infrastructure/persistence/typeorm/entities/outbox-event.orm-entity';
import { CreateChatSchema1710000000000 } from './migrations/1710000000000-create-chat-schema';
import { AlterMessagesAddReplyAndMetadata1710000000001 } from './migrations/1710000000001-alter-messages-add-reply-and-metadata';
import { CreateMessageReadReceipts1710000000002 } from './migrations/1710000000002-create-message-read-receipts';
import { AlterConversationMembers1710000000003 } from './migrations/1710000000003-alter-conversation-members';
import { CreateMessageReactions1710000000004 } from './migrations/1710000000004-create-message-reactions';

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
    MessageReadReceiptOrmEntity,
    MessageReactionOrmEntity,
    OutboxEventOrmEntity,
  ],
  migrations: [
    CreateChatSchema1710000000000,
    AlterMessagesAddReplyAndMetadata1710000000001,
    CreateMessageReadReceipts1710000000002,
    AlterConversationMembers1710000000003,
    CreateMessageReactions1710000000004,
  ],
});

