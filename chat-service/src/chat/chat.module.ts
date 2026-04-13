import { Module } from '@nestjs/common';
import { HeaderAuthGuard } from '../common/auth/header-auth.guard';
import { CreateConversationUseCase } from './application/use-cases/create-conversation.use-case';
import { GetConversationMessagesUseCase } from './application/use-cases/get-conversation-messages.use-case';
import { ListConversationsUseCase } from './application/use-cases/list-conversations.use-case';
import { SendMessageUseCase } from './application/use-cases/send-message.use-case';
import {
  CONVERSATION_REPOSITORY,
  EVENT_PUBLISHER,
  MESSAGE_REPOSITORY,
  OUTBOX_REPOSITORY,
  TRANSACTION_MANAGER,
} from './application/ports/tokens';
import { TypeOrmConversationRepository } from './infrastructure/persistence/typeorm/typeorm-conversation.repository';
import { TypeOrmMessageRepository } from './infrastructure/persistence/typeorm/typeorm-message.repository';
import { TypeOrmOutboxRepository } from './infrastructure/persistence/typeorm/typeorm-outbox.repository';
import { TypeOrmTransactionManager } from './infrastructure/persistence/typeorm/typeorm-transaction.manager';
import { RabbitMqEventPublisher } from './infrastructure/events/rabbitmq/rabbitmq-event.publisher';
import { OutboxProcessor } from './infrastructure/events/outbox/outbox.processor';
import { ChatController } from './interface/http/chat.controller';

@Module({
  controllers: [ChatController],
  providers: [
    HeaderAuthGuard,
    CreateConversationUseCase,
    ListConversationsUseCase,
    GetConversationMessagesUseCase,
    SendMessageUseCase,
    TypeOrmConversationRepository,
    TypeOrmMessageRepository,
    TypeOrmOutboxRepository,
    TypeOrmTransactionManager,
    RabbitMqEventPublisher,
    OutboxProcessor,
    {
      provide: CONVERSATION_REPOSITORY,
      useExisting: TypeOrmConversationRepository,
    },
    {
      provide: MESSAGE_REPOSITORY,
      useExisting: TypeOrmMessageRepository,
    },
    {
      provide: OUTBOX_REPOSITORY,
      useExisting: TypeOrmOutboxRepository,
    },
    {
      provide: TRANSACTION_MANAGER,
      useExisting: TypeOrmTransactionManager,
    },
    {
      provide: EVENT_PUBLISHER,
      useExisting: RabbitMqEventPublisher,
    },
  ],
})
export class ChatModule {}

