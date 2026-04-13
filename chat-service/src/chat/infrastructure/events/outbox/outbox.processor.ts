import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventPublisher } from '../../../application/ports/event.publisher';
import { OutboxRepository } from '../../../application/ports/outbox.repository';
import { EVENT_PUBLISHER, OUTBOX_REPOSITORY } from '../../../application/ports/tokens';

@Injectable()
export class OutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessor.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly configService: ConfigService,
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepository,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: EventPublisher,
  ) {}

  onModuleInit(): void {
    const intervalMs = Number(
      this.configService.get<string>('OUTBOX_POLL_INTERVAL_MS', '5000'),
    );

    this.timer = setInterval(() => {
      void this.flushPendingEvents();
    }, intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async flushPendingEvents(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const batchSize = Number(
        this.configService.get<string>('OUTBOX_BATCH_SIZE', '50'),
      );
      const pendingEvents = await this.outboxRepository.claimPendingBatch(batchSize);

      for (const event of pendingEvents) {
        try {
          await this.eventPublisher.publish(event);
          await this.outboxRepository.markPublished(event.id);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unexpected publish error.';
          this.logger.warn(
            `Failed to publish outbox event ${event.id}: ${message}`,
          );
          await this.outboxRepository.markFailed(event.id, message);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

