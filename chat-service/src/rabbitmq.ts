import { config } from './config';

export async function connectRabbitMQ(): Promise<void> {
  console.log('RabbitMQ connection skipped (will implement later)');
}

export async function publishNewMessage(payload: any): Promise<void> {
  console.log('NEW_MESSAGE event:', JSON.stringify(payload, null, 2));
}

export async function closeRabbitMQ(): Promise<void> {
  console.log('RabbitMQ closed');
}
