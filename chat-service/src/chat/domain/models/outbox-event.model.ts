import { OutboxStatus } from '../enums/outbox-status.enum';

export interface OutboxEventRecord {
  id: string;
  eventType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  occurredAt: Date;
  publishedAt: Date | null;
  retryCount: number;
  errorMessage: string | null;
}

