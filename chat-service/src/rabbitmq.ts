import { config } from './config';

let rabbitConnected = false;
let rabbitLastError: string | null = null;

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
  console.log('NEW_MESSAGE event:', JSON.stringify(payload, null, 2));
}

export async function closeRabbitMQ(): Promise<void> {
  rabbitConnected = false;
  console.log('RabbitMQ closed');
}

export function getRabbitMQStatus() {
  return {
    connected: rabbitConnected,
    lastError: rabbitLastError,
  };
}
