import { randomUUID } from "crypto";
import {
  ConversationListResult,
  ConversationRepository,
  CreateConversationPersistenceParams,
  ListConversationsPersistenceParams,
} from "../../src/chat/application/ports/conversation.repository";
import {
  CreateMessagePersistenceParams,
  ListMessagesPersistenceParams,
  MessageListResult,
  MessageRepository,
} from "../../src/chat/application/ports/message.repository";
import {
  CreateOutboxEventParams,
  OutboxRepository,
} from "../../src/chat/application/ports/outbox.repository";
import {
  TransactionContext,
  TransactionManager,
} from "../../src/chat/application/ports/transaction-manager";
import { DirectConversationConflictError } from "../../src/chat/application/errors/direct-conversation-conflict.error";
import { OutboxStatus } from "../../src/chat/domain/enums/outbox-status.enum";
import {
  ConversationListItem,
  ConversationWithMembers,
  LastMessageSnapshot,
} from "../../src/chat/domain/models/conversation.model";
import { Message } from "../../src/chat/domain/models/message.model";
import { OutboxEventRecord } from "../../src/chat/domain/models/outbox-event.model";
import { EventPublisher } from "../../src/chat/application/ports/event.publisher";

class DateSequencer {
  private current = new Date("2026-01-01T00:00:00.000Z").getTime();

  next(): Date {
    const value = new Date(this.current);
    this.current += 1000;
    return value;
  }
}

export class InMemoryConversationRepository implements ConversationRepository {
  readonly conversations = new Map<string, ConversationWithMembers>();

  constructor(private readonly dates: DateSequencer = new DateSequencer()) {}

  async findById(
    conversationId: string,
  ): Promise<ConversationWithMembers | null> {
    return this.conversations.get(conversationId) ?? null;
  }

  async findDirectByKey(
    directKey: string,
  ): Promise<ConversationWithMembers | null> {
    return (
      [...this.conversations.values()].find(
        (conversation) => conversation.directKey === directKey,
      ) ?? null
    );
  }

  async create(
    params: CreateConversationPersistenceParams,
    _context?: TransactionContext,
  ): Promise<ConversationWithMembers> {
    if (
      params.directKey &&
      [...this.conversations.values()].some(
        (conversation) => conversation.directKey === params.directKey,
      )
    ) {
      throw new DirectConversationConflictError();
    }

    const now = this.dates.next();
    const conversation: ConversationWithMembers = {
      id: randomUUID(),
      type: params.type,
      title: params.title,
      createdBy: params.createdBy,
      directKey: params.directKey,
      lastMessageId: null,
      lastMessagePreview: null,
      lastMessageAt: null,
      createdAt: now,
      updatedAt: now,
      memberIds: [...params.memberIds],
      memberCount: params.memberIds.length,
    };

    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  async listForUser(
    params: ListConversationsPersistenceParams,
  ): Promise<ConversationListResult> {
    const filtered = [...this.conversations.values()]
      .filter((conversation) => conversation.memberIds.includes(params.userId))
      .map<ConversationListItem>((conversation) => ({
        ...conversation,
        activityAt: conversation.lastMessageAt ?? conversation.updatedAt,
      }))
      .sort((left, right) => {
        const activityDelta =
          right.activityAt.getTime() - left.activityAt.getTime();
        return activityDelta !== 0
          ? activityDelta
          : right.id.localeCompare(left.id);
      });

    const paged = params.cursor
      ? filtered.filter((conversation) => {
          const activityAt = conversation.activityAt.toISOString();
          return (
            activityAt < params.cursor!.activityAt ||
            (activityAt === params.cursor!.activityAt &&
              conversation.id < params.cursor!.conversationId)
          );
        })
      : filtered;

    return {
      items: paged.slice(0, params.limit),
      hasMore: paged.length > params.limit,
    };
  }

  async updateLastMessage(
    conversationId: string,
    lastMessage: LastMessageSnapshot,
  ): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return;
    }

    conversation.lastMessageId = lastMessage.id;
    conversation.lastMessagePreview = lastMessage.preview;
    conversation.lastMessageAt = lastMessage.createdAt;
    conversation.updatedAt = lastMessage.createdAt;
  }
}

export class InMemoryMessageRepository implements MessageRepository {
  readonly messages: Message[] = [];

  constructor(private readonly dates: DateSequencer = new DateSequencer()) {}

  async create(
    params: CreateMessagePersistenceParams,
    _context?: TransactionContext,
  ): Promise<Message> {
    const message: Message = {
      id: randomUUID(),
      conversationId: params.conversationId,
      senderId: params.senderId,
      contentType: params.contentType,
      content: params.content,
      createdAt: this.dates.next(),
    };

    this.messages.push(message);
    return message;
  }

  async listByConversation(
    params: ListMessagesPersistenceParams,
  ): Promise<MessageListResult> {
    const filtered = this.messages
      .filter((message) => message.conversationId === params.conversationId)
      .sort((left, right) => {
        const delta = right.createdAt.getTime() - left.createdAt.getTime();
        return delta !== 0 ? delta : right.id.localeCompare(left.id);
      });

    const paged = params.before
      ? filtered.filter((message) => {
          const createdAt = message.createdAt.toISOString();
          return (
            createdAt < params.before!.createdAt ||
            (createdAt === params.before!.createdAt &&
              message.id < params.before!.messageId)
          );
        })
      : filtered;

    return {
      items: paged.slice(0, params.limit).reverse(),
      hasMore: paged.length > params.limit,
    };
  }
}

export class InMemoryOutboxRepository implements OutboxRepository {
  readonly events: OutboxEventRecord[] = [];

  async create(
    params: CreateOutboxEventParams,
    _context?: TransactionContext,
  ): Promise<void> {
    this.events.push({
      id: randomUUID(),
      eventType: params.eventType,
      aggregateId: params.aggregateId,
      payload: params.payload,
      status: OutboxStatus.PENDING,
      occurredAt: params.occurredAt,
      publishedAt: null,
      retryCount: 0,
      errorMessage: null,
    });
  }

  async claimPendingBatch(limit: number): Promise<OutboxEventRecord[]> {
    const pending = this.events
      .filter((event) => event.status === OutboxStatus.PENDING)
      .slice(0, limit);

    for (const event of pending) {
      event.status = OutboxStatus.PROCESSING;
    }

    return pending;
  }

  async markPublished(eventId: string): Promise<void> {
    const event = this.events.find((item) => item.id === eventId);
    if (!event) {
      return;
    }

    event.status = OutboxStatus.PUBLISHED;
    event.publishedAt = new Date("2026-01-01T00:10:00.000Z");
    event.errorMessage = null;
  }

  async markFailed(eventId: string, errorMessage: string): Promise<void> {
    const event = this.events.find((item) => item.id === eventId);
    if (!event) {
      return;
    }

    event.status = OutboxStatus.PENDING;
    event.retryCount += 1;
    event.errorMessage = errorMessage;
  }
}

export class InMemoryTransactionManager implements TransactionManager {
  async runInTransaction<T>(
    operation: (context: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return operation({
      manager: undefined,
    });
  }
}

export class FakeEventPublisher implements EventPublisher {
  readonly published: OutboxEventRecord[] = [];
  shouldFail = false;

  async publish(event: OutboxEventRecord): Promise<void> {
    if (this.shouldFail) {
      throw new Error("publisher unavailable");
    }

    this.published.push(event);
  }
}

export function createInMemoryDependencies(): {
  conversationRepository: InMemoryConversationRepository;
  messageRepository: InMemoryMessageRepository;
  outboxRepository: InMemoryOutboxRepository;
  transactionManager: InMemoryTransactionManager;
  dateSequencer: DateSequencer;
} {
  const dateSequencer = new DateSequencer();

  return {
    conversationRepository: new InMemoryConversationRepository(dateSequencer),
    messageRepository: new InMemoryMessageRepository(dateSequencer),
    outboxRepository: new InMemoryOutboxRepository(),
    transactionManager: new InMemoryTransactionManager(),
    dateSequencer,
  };
}
