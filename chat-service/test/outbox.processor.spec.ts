import { ConfigService } from "@nestjs/config";
import { OutboxProcessor } from "../src/chat/infrastructure/events/outbox/outbox.processor";
import {
  FakeEventPublisher,
  InMemoryOutboxRepository,
} from "./support/in-memory-chat.dependencies";
import { OutboxStatus } from "../src/chat/domain/enums/outbox-status.enum";

function createConfigService(): ConfigService {
  return {
    get: <T>(key: string, defaultValue?: T) => {
      if (key === "OUTBOX_BATCH_SIZE") {
        return "50" as T;
      }

      if (key === "OUTBOX_POLL_INTERVAL_MS") {
        return "5000" as T;
      }

      return defaultValue as T;
    },
  } as ConfigService;
}

describe("OutboxProcessor", () => {
  it("marks events as published when publishing succeeds", async () => {
    const outboxRepository = new InMemoryOutboxRepository();
    const publisher = new FakeEventPublisher();
    const processor = new OutboxProcessor(
      createConfigService(),
      outboxRepository,
      publisher,
    );

    await outboxRepository.create({
      eventType: "NEW_MESSAGE",
      aggregateId: "message-1",
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      payload: {
        eventType: "NEW_MESSAGE",
      },
    });

    await processor.flushPendingEvents();

    expect(publisher.published).toHaveLength(1);
    expect(outboxRepository.events[0].status).toBe(OutboxStatus.PUBLISHED);
  });

  it("returns failed publishes to pending status and increments retry count", async () => {
    const outboxRepository = new InMemoryOutboxRepository();
    const publisher = new FakeEventPublisher();
    publisher.shouldFail = true;
    const processor = new OutboxProcessor(
      createConfigService(),
      outboxRepository,
      publisher,
    );

    await outboxRepository.create({
      eventType: "NEW_MESSAGE",
      aggregateId: "message-1",
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      payload: {
        eventType: "NEW_MESSAGE",
      },
    });

    await processor.flushPendingEvents();

    expect(outboxRepository.events[0].status).toBe(OutboxStatus.PENDING);
    expect(outboxRepository.events[0].retryCount).toBe(1);
    expect(outboxRepository.events[0].errorMessage).toBe(
      "publisher unavailable",
    );
  });
});
