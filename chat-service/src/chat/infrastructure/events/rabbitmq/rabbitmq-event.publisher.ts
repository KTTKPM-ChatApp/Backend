import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelModel, connect } from 'amqplib';
import { EventPublisher } from '../../../application/ports/event.publisher';
import { OutboxEventRecord } from '../../../domain/models/outbox-event.model';

@Injectable()
export class RabbitMqEventPublisher
  implements EventPublisher, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitMqEventPublisher.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly configService: ConfigService) {}

  async publish(event: OutboxEventRecord): Promise<void> {
    const exchange = this.configService.get<string>(
      'RABBITMQ_EXCHANGE',
      'chat.events',
    );
    const routingKey = this.resolveRoutingKey(event.eventType);
    const channel = await this.getChannel(exchange);
    const payload = Buffer.from(JSON.stringify(event.payload), 'utf-8');
    const published = channel.publish(exchange, routingKey, payload, {
      contentType: 'application/json',
      persistent: true,
      type: event.eventType,
      messageId: event.id,
      timestamp: event.occurredAt.getTime(),
    });

    if (!published) {
      throw new Error('RabbitMQ channel backpressure prevented publishing.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async getChannel(exchange: string): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    const rabbitMqUrl = this.configService.get<string>(
      'RABBITMQ_URL',
      'amqp://guest:guest@localhost:5672',
    );

    const connection = await connect(rabbitMqUrl);
    connection.on('error', (error) => {
      this.logger.error(`RabbitMQ connection error: ${error.message}`);
      this.channel = null;
      this.connection = null;
    });
    connection.on('close', () => {
      this.logger.warn('RabbitMQ connection closed.');
      this.channel = null;
      this.connection = null;
    });

    const channel = await connection.createChannel();
    await channel.assertExchange(exchange, 'topic', {
      durable: true,
    });

    this.connection = connection;
    this.channel = channel;

    return channel;
  }

  private resolveRoutingKey(eventType: string): string {
    if (eventType === 'NEW_MESSAGE') {
      return this.configService.get<string>(
        'RABBITMQ_ROUTING_KEY_NEW_MESSAGE',
        'chat.new_message',
      );
    }

    throw new Error(`Unsupported event type "${eventType}".`);
  }
}
