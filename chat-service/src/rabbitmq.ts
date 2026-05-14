import amqp from 'amqplib';
import { config } from './config';

let connection: any = null;
let channel: any = null;

export async function connectRabbitMQ(): Promise<void> {
  try {
    connection = await amqp.connect(config.rabbitmq.url);
    if (connection) {
      channel = await connection.createChannel();
      
      // Declare the exchange
      if (channel) {
        await channel.assertExchange(config.rabbitmq.exchange, 'topic', { durable: true });
      }
      
      console.log('RabbitMQ connected successfully');
    }
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    // Don't throw error, allow service to continue without RabbitMQ
    console.log('Continuing without RabbitMQ (graceful degradation)');
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
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    console.log('RabbitMQ connection closed');
  } catch (error) {
    console.error('Error closing RabbitMQ connection:', error);
  }
}
