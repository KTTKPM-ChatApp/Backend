import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConversationMemberOrmEntity } from '../chat/infrastructure/persistence/typeorm/entities/conversation-member.orm-entity';
import { ConversationOrmEntity } from '../chat/infrastructure/persistence/typeorm/entities/conversation.orm-entity';
import { MessageOrmEntity } from '../chat/infrastructure/persistence/typeorm/entities/message.orm-entity';
import { OutboxEventOrmEntity } from '../chat/infrastructure/persistence/typeorm/entities/outbox-event.orm-entity';

export function getTypeOrmOptions(
  configService: ConfigService,
): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: configService.get<string>('DATABASE_HOST', 'localhost'),
    port: Number(configService.get<string>('DATABASE_PORT', '5432')),
    username: configService.get<string>('DATABASE_USER', 'postgres'),
    password: configService.get<string>('DATABASE_PASSWORD', 'postgres'),
    database: configService.get<string>('DATABASE_NAME', 'chat_service'),
    ssl: configService.get<string>('DATABASE_SSL', 'false') === 'true',
    entities: [
      ConversationOrmEntity,
      ConversationMemberOrmEntity,
      MessageOrmEntity,
      OutboxEventOrmEntity,
    ],
    migrations: ['dist/database/migrations/*.js'],
    synchronize: false,
    logging: false,
  };
}
