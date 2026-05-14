import amqp from 'amqplib';
import { config } from './config';

let rabbitConnected = false;
let rabbitLastError: string | null = null;
let channel: amqp.Channel | null = null;

export async function connectRabbitMQ(): Promise<void> {
  try {
    // Placeholder implementation - keep service boot resilient even when RabbitMQ is optional.
    rabbitConnected = false;
    rabbitLastError = 'RabbitMQ connection is not implemented yet';
    console.log('RabbitMQ connection skipped (will implement later)');
  } catch (error: any) {
    rabbitConnected = false;
    rabbitLastError = error?.message || 'Unknown RabbitMQ error';
    throw error;
  }
}

export async function publishNewMessage(payload: any): Promise<void> {
  if (!channel) {
    console.log('RabbitMQ channel not available, skipping message publishing');
    return;
  }

  try {
    const message = Buffer.from(JSON.stringify(payload));
    const routingKey = config.rabbitmq.routingKeyNewMessage;
    
    await channel.publish(config.rabbitmq.exchange, routingKey, message, {
      persistent: true,
      messageId: payload.messageId,
      timestamp: Date.now(),
    });
    
    console.log(`Published message ${payload.messageId} to RabbitMQ`);
  } catch (error) {
    console.error('Failed to publish message to RabbitMQ:', error);
    // Don't throw error, don't fail the main request
  }
}

export async function closeRabbitMQ(): Promise<void> {
  channel = null;
  rabbitConnected = false;
  console.log('RabbitMQ closed');
}

export function getRabbitMQStatus() {
  return {
    connected: rabbitConnected,
    lastError: rabbitLastError,
  };
}
