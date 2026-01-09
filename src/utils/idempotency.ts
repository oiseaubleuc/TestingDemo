import { ProcessedMessage } from '../types/message';
import logger from './logger';

const processedMessages = new Map<string, ProcessedMessage>();

export function isMessageProcessed(messageId: string): boolean {
  return processedMessages.has(messageId);
}

export function markMessageProcessed(
  messageId: string,
  status: 'success' | 'failed',
  error?: string
): void {
  const processed: ProcessedMessage = {
    messageId,
    processedAt: new Date().toISOString(),
    status,
    error,
  };

  processedMessages.set(messageId, processed);
  logger.info(`Message ${messageId} marked as ${status}`, {
    messageId,
    status,
    hasError: !!error,
  });
}

export function getMessageStatus(
  messageId: string
): ProcessedMessage | undefined {
  return processedMessages.get(messageId);
}

export function clearProcessedMessages(): void {
  processedMessages.clear();
  logger.info('Processed messages cache cleared');
}
