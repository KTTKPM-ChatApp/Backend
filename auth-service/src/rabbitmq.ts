import amqp from 'amqplib';
import { config } from './config';

let connection: amqp.ChannelModel | null = null;
let channel: amqp.Channel | null = null;
let rabbitConnected = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempt = 0;
let shuttingDown = false;

const EXCHANGE_NAME = 'chat.events';

function reconnectDelay() {
  const baseMs = config.rabbitmq.reconnectInitialDelayMs;
  const maxMs = config.rabbitmq.reconnectMaxDelayMs;
  const exponential = Math.min(maxMs, baseMs * 2 ** Math.max(0, reconnectAttempt));
  const jitter = Math.floor(Math.random() * Math.min(baseMs, exponential) * 0.25);
  return exponential + jitter;
}

function scheduleReconnect(reason: string) {
  if (shuttingDown || reconnectTimer) return;

  const delayMs = reconnectDelay();
  reconnectAttempt += 1;
  console.warn(`[Auth] RabbitMQ reconnecting in ${delayMs}ms: ${reason}`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await connectRabbitMQ();
  }, delayMs);
}

export async function connectRabbitMQ(): Promise<void> {
  try {
    connection = await amqp.connect(config.rabbitmq.url);
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    rabbitConnected = true;
    reconnectAttempt = 0;
    console.log('[Auth] RabbitMQ connected');

    connection.connection.on('error', (err: Error) => {
      rabbitConnected = false;
      console.error('[Auth] RabbitMQ error:', err.message);
    });
    connection.connection.on('close', () => {
      rabbitConnected = false;
      channel = null;
      connection = null;
      console.log('[Auth] RabbitMQ closed');
      scheduleReconnect('connection closed');
    });
  } catch (error: any) {
    rabbitConnected = false;
    console.error('[Auth] Failed to connect RabbitMQ:', error?.message);
    scheduleReconnect(error?.message || 'connect failed');
  }
}

export async function closeRabbitMQ(): Promise<void> {
  try {
    shuttingDown = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
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
