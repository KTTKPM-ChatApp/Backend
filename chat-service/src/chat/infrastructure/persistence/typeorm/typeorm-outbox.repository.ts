import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  CreateOutboxEventParams,
  OutboxRepository,
} from '../../../application/ports/outbox.repository';
import { TransactionContext } from '../../../application/ports/transaction-manager';
import { OutboxStatus } from '../../../domain/enums/outbox-status.enum';
import { OutboxEventRecord } from '../../../domain/models/outbox-event.model';
import { OutboxEventOrmEntity } from './entities/outbox-event.orm-entity';
import { getEntityManager } from './typeorm-helpers';

@Injectable()
export class TypeOrmOutboxRepository implements OutboxRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(
    params: CreateOutboxEventParams,
    context?: TransactionContext,
  ): Promise<void> {
    const manager = getEntityManager(this.dataSource.manager, context);
    const repository = manager.getRepository(OutboxEventOrmEntity);
    const event = repository.create({
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

    await repository.save(event);
  }

  async claimPendingBatch(limit: number): Promise<OutboxEventRecord[]> {
    const rows = await this.dataSource.transaction(async (manager) =>
      manager.query(
        `
          UPDATE outbox_events
          SET status = $1
          WHERE id IN (
            SELECT id
            FROM outbox_events
            WHERE status = $2
            ORDER BY occurred_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT $3
          )
          RETURNING id, event_type, aggregate_id, payload, status, occurred_at, published_at, retry_count, error_message
        `,
        [OutboxStatus.PROCESSING, OutboxStatus.PENDING, limit],
      ),
    );

    return rows.map((row: Record<string, unknown>) => this.mapRow(row));
  }

  async markPublished(eventId: string): Promise<void> {
    await this.dataSource.manager.getRepository(OutboxEventOrmEntity).update(
      {
        id: eventId,
      },
      {
        status: OutboxStatus.PUBLISHED,
        publishedAt: new Date(),
        errorMessage: null,
      },
    );
  }

  async markFailed(eventId: string, errorMessage: string): Promise<void> {
    await this.dataSource.manager.query(
      `
        UPDATE outbox_events
        SET status = $1,
            retry_count = retry_count + 1,
            error_message = $2
        WHERE id = $3
      `,
      [OutboxStatus.PENDING, errorMessage.slice(0, 2000), eventId],
    );
  }

  private mapRow(row: Record<string, unknown>): OutboxEventRecord {
    const payload = row.payload;

    return {
      id: String(row.id),
      eventType: String(row.event_type),
      aggregateId: String(row.aggregate_id),
      payload:
        typeof payload === 'string'
          ? (JSON.parse(payload) as Record<string, unknown>)
          : (payload as Record<string, unknown>),
      status: row.status as OutboxStatus,
      occurredAt: new Date(String(row.occurred_at)),
      publishedAt: row.published_at ? new Date(String(row.published_at)) : null,
      retryCount: Number(row.retry_count),
      errorMessage: row.error_message ? String(row.error_message) : null,
    };
  }
}

