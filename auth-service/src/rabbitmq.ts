import amqp from 'amqplib';
import { config } from './config';

let connection: amqp.ChannelModel | null = null;
let channel: amqp.Channel | null = null;
let rabbitConnected = false;

const EXCHANGE_NAME = 'chat.events';

export async function connectRabbitMQ(): Promise<void> {
  try {
    connection = await amqp.connect(config.rabbitmq.url);
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    rabbitConnected = true;
    console.log('[Auth] RabbitMQ connected');

    connection.connection.on('error', (err: Error) => {
      rabbitConnected = false;
      console.error('[Auth] RabbitMQ error:', err.message);
    });
    connection.connection.on('close', () => {
      rabbitConnected = false;
      console.log('[Auth] RabbitMQ closed');
    });
  } catch (error: any) {
    rabbitConnected = false;
    console.error('[Auth] Failed to connect RabbitMQ:', error?.message);
  }
}

export async function closeRabbitMQ(): Promise<void> {
  try {
    if (channel) { await channel.close(); channel = null; }
    if (connection) { await connection.close(); connection = null; }
    rabbitConnected = false;
  } catch (error) {
    console.error('[Auth] Error closing RabbitMQ:', error);
  }
}

export async function publishEvent(routingKey: string, payload: any): Promise<boolean> {
  if (!channel || !rabbitConnected) {
    console.warn('[Auth] RabbitMQ not connected, skip event:', routingKey);
    return false;
  }
  try {
    const message = Buffer.from(JSON.stringify(payload));
    return channel.publish(EXCHANGE_NAME, routingKey, message, { persistent: true });
  } catch (error) {
    console.error('[Auth] Failed to publish event:', routingKey, error);
    return false;
  }
}

export interface UserEventPayload {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  email: string;
  isActive: boolean;
  bio?: string | null;
  gender?: string | null;
  phone?: string | null;
}

export async function publishUserCreated(user: UserEventPayload): Promise<boolean> {
  return publishEvent('user.created', {
    event: 'user.created',
    timestamp: new Date().toISOString(),
    data: user,
  });
}

export async function publishUserUpdated(id: string, changes: Partial<UserEventPayload>): Promise<boolean> {
  return publishEvent('user.updated', {
    event: 'user.updated',
    timestamp: new Date().toISOString(),
    data: { id, changes },
  });
}
