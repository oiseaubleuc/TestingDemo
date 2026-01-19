import { EventType, RabbitMQMessage } from '../types/message';
import { isMessageProcessed, markMessageProcessed, clearProcessedMessages, getMessageStatus } from '../utils/idempotency';

describe('Message Types', () => {
  test('should create a valid RabbitMQ message', () => {
    const message: RabbitMQMessage = {
      messageId: 'test-id-123',
      event: EventType.CREATE_ORDER,
      payload: {
        order: {
          id: 'ORD001',
          customerId: 'CUST001',
          amount: 100.0,
          currency: 'EUR',
          items: [],
        },
      },
      timestamp: new Date().toISOString(),
    };

    expect(message.messageId).toBe('test-id-123');
    expect(message.event).toBe(EventType.CREATE_ORDER);
    expect(message.payload.order).toBeDefined();
  });
});

describe('Idempotency', () => {
  beforeEach(() => {
    clearProcessedMessages();
  });

  test('should mark message as processed', () => {
    const messageId = 'test-message-123';
    expect(isMessageProcessed(messageId)).toBe(false);

    markMessageProcessed(messageId, 'success');
    expect(isMessageProcessed(messageId)).toBe(true);
  });

  test('should prevent duplicate processing', () => {
    const messageId = 'test-message-456';
    markMessageProcessed(messageId, 'success');

    expect(isMessageProcessed(messageId)).toBe(true);
  });

  test('should track failed messages', () => {
    const messageId = 'test-message-789';
    markMessageProcessed(messageId, 'failed', 'Test error');

    expect(isMessageProcessed(messageId)).toBe(true);
    const status = getMessageStatus(messageId);
    expect(status?.status).toBe('failed');
    expect(status?.error).toBe('Test error');
  });
});
