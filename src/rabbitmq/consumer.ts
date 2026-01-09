import * as amqp from 'amqplib';
import { RabbitMQMessage } from '../types/message';
import { config } from '../config';
import logger from '../utils/logger';
import { isMessageProcessed, markMessageProcessed } from '../utils/idempotency';
import { SalesforceService } from '../services/salesforce';

export class RabbitMQConsumer {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private salesforceService: SalesforceService;
  private isProcessing = false;

  constructor(salesforceService: SalesforceService) {
    this.salesforceService = salesforceService;
  }

  async connect(): Promise<void> {
    try {
      logger.info('Consumer: Connecting to RabbitMQ', {
        url: config.rabbitmq.url,
      });
      this.connection = (await amqp.connect(config.rabbitmq.url) as unknown) as amqp.Connection;
      if (!this.connection) {
        throw new Error('Failed to establish RabbitMQ connection');
      }
      // @ts-ignore
      this.channel = await this.connection.createChannel();

      if (!this.channel) {
        throw new Error('Failed to create RabbitMQ channel');
      }

      await this.channel.assertQueue(config.rabbitmq.queue, {
        durable: true,
      });

      await this.channel.assertQueue(config.rabbitmq.dlq, {
        durable: true,
      });

      await this.channel.prefetch(1);

      logger.info('Consumer: Connected to RabbitMQ successfully');
    } catch (error) {
      logger.error('Consumer: Failed to connect to RabbitMQ', { error });
      throw error;
    }
  }

  async startConsuming(): Promise<void> {
    if (!this.channel) {
      throw new Error('Not connected to RabbitMQ');
    }

    logger.info('Consumer: Starting to consume messages', {
      queue: config.rabbitmq.queue,
    });

      await this.channel.consume(
      config.rabbitmq.queue,
      async (msg: amqp.ConsumeMessage | null) => {
        if (!msg) {
          return;
        }

        try {
          await this.processMessage(msg);
        } catch (error) {
          logger.error('Consumer: Error processing message', { error });
        }
      },
      {
        noAck: false,
      }
    );
  }

  private async processMessage(msg: amqp.ConsumeMessage): Promise<void> {
    if (!this.channel) {
      return;
    }

    let message: RabbitMQMessage;
    try {
      message = JSON.parse(msg.content.toString());
    } catch (error) {
      logger.error('Consumer: Failed to parse message', { error });
      this.channel.nack(msg, false, false);
      return;
    }

    const { messageId, event, payload } = message;

    logger.info('Consumer: Received message', {
      messageId,
      event,
      timestamp: message.timestamp,
    });

    if (isMessageProcessed(messageId)) {
      logger.warn('Consumer: Message already processed (duplicate)', {
        messageId,
      });
      this.channel.ack(msg);
      return;
    }

    try {
      await this.handleMessage(message);
      markMessageProcessed(messageId, 'success');
      this.channel.ack(msg);
      logger.info('Consumer: Message processed successfully', { messageId });
    } catch (error: any) {
      logger.error('Consumer: Failed to process message', {
        messageId,
        error: error.message,
      });

      const retryCount = (message.retryCount || 0) + 1;
      if (retryCount < config.rabbitmq.maxRetries) {
        logger.info('Consumer: Retrying message', {
          messageId,
          retryCount,
          maxRetries: config.rabbitmq.maxRetries,
        });

        message.retryCount = retryCount;
        const retryBuffer = Buffer.from(JSON.stringify(message));
        this.channel.sendToQueue(config.rabbitmq.queue, retryBuffer, {
          persistent: true,
          messageId: message.messageId,
        });
        this.channel.ack(msg);
      } else {
        logger.error('Consumer: Max retries reached, sending to DLQ', {
          messageId,
          retryCount,
        });
        await this.sendToDLQ(message, error.message);
        this.channel.ack(msg);
        markMessageProcessed(messageId, 'failed', error.message);
      }
    }
  }

  private async handleMessage(message: RabbitMQMessage): Promise<void> {
    const { event, payload } = message;

    switch (event) {
      case 'CREATE_ORDER':
      case 'UPDATE_ORDER':
        if (payload.order) {
          await this.salesforceService.createOrUpdateOrder(payload.order);
        }
        break;
      case 'CREATE_CUSTOMER':
      case 'UPDATE_CUSTOMER':
        if (payload.customer) {
          await this.salesforceService.createOrUpdateCustomer(
            payload.customer
          );
        }
        break;
      default:
        throw new Error(`Unknown event type: ${event}`);
    }
  }

  private async sendToDLQ(
    message: RabbitMQMessage,
    error: string
  ): Promise<void> {
    if (!this.channel) {
      return;
    }

    const dlqMessage = {
      ...message,
      dlqReason: error,
      dlqTimestamp: new Date().toISOString(),
    };

    const dlqBuffer = Buffer.from(JSON.stringify(dlqMessage));
    this.channel.sendToQueue(config.rabbitmq.dlq, dlqBuffer, {
      persistent: true,
    });

    logger.error('Consumer: Message sent to DLQ', {
      messageId: message.messageId,
      error,
    });
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        // @ts-ignore
        await this.connection.close();
      }
      logger.info('Consumer: RabbitMQ connection closed');
    } catch (error) {
      logger.error('Consumer: Error closing RabbitMQ connection', { error });
    }
  }
}
