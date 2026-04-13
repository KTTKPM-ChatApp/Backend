import { OutboxEventRecord } from '../../domain/models/outbox-event.model';
import { TransactionContext } from './transaction-manager';

export interface CreateOutboxEventParams {
  eventType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

export interface OutboxRepository {
  create(
    params: CreateOutboxEventParams,
    context?: TransactionContext,
  ): Promise<void>;
  claimPendingBatch(limit: number): Promise<OutboxEventRecord[]>;
  markPublished(eventId: string): Promise<void>;
  markFailed(eventId: string, errorMessage: string): Promise<void>;
}

