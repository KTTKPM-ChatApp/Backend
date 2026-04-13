import { OutboxEventRecord } from '../../domain/models/outbox-event.model';

export interface EventPublisher {
  publish(event: OutboxEventRecord): Promise<void>;
}

