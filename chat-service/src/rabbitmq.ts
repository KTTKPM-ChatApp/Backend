import amqp from 'amqplib';
import { config } from './config';

let connection: amqp.ChannelModel | null = null;
let channel: amqp.Channel | null = null;
let rabbitConnected = false;
let rabbitLastError: string | null = null;

const EXCHANGE_NAME = config.rabbitmq.exchange;

export async function connectRabbitMQ(): Promise<void> {
  try {
    connection = await amqp.connect(config.rabbitmq.url);
    channel = await connection.createChannel();

    // Declare the exchange
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

    rabbitConnected = true;
    rabbitLastError = null;
    console.log('RabbitMQ connected successfully');

    connection.connection.on('error', (err: Error) => {
      rabbitConnected = false;
      rabbitLastError = err?.message || 'RabbitMQ connection error';
      console.error('RabbitMQ connection error:', err.message);
    });

    connection.connection.on('close', () => {
      rabbitConnected = false;
      console.log('RabbitMQ connection closed');
    });
  } catch (error: any) {
    rabbitConnected = false;
    rabbitLastError = error?.message || 'Unknown RabbitMQ error';
    console.error('Failed to connect to RabbitMQ:', error?.message);
    // Don't throw - keep service boot resilient
  }
}

export async function closeRabbitMQ(): Promise<void> {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    rabbitConnected = false;
    console.log('RabbitMQ closed');
  } catch (error) {
    console.error('Error closing RabbitMQ:', error);
  }
}

export function getRabbitMQStatus() {
  return {
    connected: rabbitConnected,
    lastError: rabbitLastError,
  };
}

// Event publishing functions
export async function publishEvent(routingKey: string, payload: any): Promise<boolean> {
  if (!channel || !rabbitConnected) {
    console.warn('RabbitMQ not connected, skipping event publish:', routingKey);
    return false;
  }

  try {
    const message = Buffer.from(JSON.stringify(payload));
    return channel.publish(EXCHANGE_NAME, routingKey, message, { persistent: true });
  } catch (error) {
    console.error('Failed to publish event:', routingKey, error);
    return false;
  }
}

// Event types and publishers
export interface ChatEvent {
  event: string;
  timestamp: string;
  data: any;
}

export async function publishNewMessage(payload: {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: string;
  contentType: string;
}): Promise<boolean> {
  const event: ChatEvent = {
    event: 'message.sent',
    timestamp: new Date().toISOString(),
    data: payload,
  };
  return publishEvent('chat.message.sent', event);
}

export async function publishConversationCreated(payload: {
  conversationId: string;
  type: 'DIRECT' | 'GROUP';
  createdBy: string;
  memberIds: string[];
  title?: string;
}): Promise<boolean> {
  const event: ChatEvent = {
    event: 'conversation.created',
    timestamp: new Date().toISOString(),
    data: payload,
  };
  return publishEvent('chat.conversation.created', event);
}

export async function publishMessageRead(payload: {
  messageId: string;
  conversationId: string;
  userId: string;
  readAt: string;
}): Promise<boolean> {
  const event: ChatEvent = {
    event: 'message.read',
    timestamp: new Date().toISOString(),
    data: payload,
  };
  return publishEvent('chat.message.read', event);
}

export async function publishUserOnline(payload: {
  userId: string;
  online: boolean;
}): Promise<boolean> {
  const event: ChatEvent = {
    event: 'user.online',
    timestamp: new Date().toISOString(),
    data: payload,
  };
  return publishEvent('chat.user.online', event);
}

export async function publishTyping(payload: {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}): Promise<boolean> {
  const event: ChatEvent = {
    event: payload.isTyping ? 'typing.start' : 'typing.stop',
    timestamp: new Date().toISOString(),
    data: payload,
  };
  return publishEvent(`chat.typing.${payload.isTyping ? 'start' : 'stop'}`, event);
}