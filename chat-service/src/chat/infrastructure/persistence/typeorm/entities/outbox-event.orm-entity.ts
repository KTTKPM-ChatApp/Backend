import { Column, Entity, PrimaryColumn } from 'typeorm';
import { OutboxStatus } from '../../../../domain/enums/outbox-status.enum';

@Entity({ name: 'outbox_events' })
export class OutboxEventOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({
    name: 'event_type',
    type: 'varchar',
    length: 128,
  })
  eventType!: string;

  @Column({
    name: 'aggregate_id',
    type: 'uuid',
  })
  aggregateId!: string;

  @Column({
    type: 'jsonb',
  })
  payload!: Record<string, unknown>;

  @Column({
    type: 'varchar',
    length: 32,
  })
  status!: OutboxStatus;

  @Column({
    name: 'occurred_at',
    type: 'timestamptz',
  })
  occurredAt!: Date;

  @Column({
    name: 'published_at',
    type: 'timestamptz',
    nullable: true,
  })
  publishedAt!: Date | null;

  @Column({
    name: 'retry_count',
    type: 'int',
    default: 0,
  })
  retryCount!: number;

  @Column({
    name: 'error_message',
    type: 'text',
    nullable: true,
  })
  errorMessage!: string | null;
}

