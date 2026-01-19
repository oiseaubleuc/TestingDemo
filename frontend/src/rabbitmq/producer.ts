import * as amqp from 'amqplib';
import { RabbitMQMessage } from '../types/message';
import { config } from '../config';
import logger from '../utils/logger';

export class RabbitMQProducer {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to RabbitMQ', { url: config.rabbitmq.url });
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

      logger.info('Connected to RabbitMQ successfully');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ', { error });
      throw error;
    }
  }

  async sendMessage(message: RabbitMQMessage): Promise<boolean> {
    if (!this.channel) {
      throw new Error('Not connected to RabbitMQ');
    }

    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      const sent = this.channel.sendToQueue(
        config.rabbitmq.queue,
        messageBuffer,
        {
          persistent: true,
          messageId: message.messageId,
        }
      );

      if (sent) {
        logger.info('Message sent to queue', {
          messageId: message.messageId,
          event: message.event,
          queue: config.rabbitmq.queue,
        });
        return true;
      } else {
        logger.warn('Message not sent (queue full?)', {
          messageId: message.messageId,
        });
        return false;
      }
    } catch (error) {
      logger.error('Failed to send message', {
        error,
        messageId: message.messageId,
      });
      throw error;
    }
  }

  async getQueueInfo(): Promise<{ queue: string; messageCount: number }> {
    if (!this.channel) {
      throw new Error('Not connected to RabbitMQ');
    }

    const queueInfo = await this.channel.checkQueue(config.rabbitmq.queue);
    return {
      queue: config.rabbitmq.queue,
      messageCount: queueInfo.messageCount,
    };
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
      logger.info('RabbitMQ connection closed');
    } catch (error) {
      logger.error('Error closing RabbitMQ connection', { error });
    }
  }
}
