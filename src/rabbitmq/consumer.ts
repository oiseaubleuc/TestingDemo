import * as amqp from 'amqplib';
import { RabbitMQMessage } from '../types/message';
import { config } from '../config';
import logger from '../utils/logger';
import { isMessageProcessed, markMessageProcessed } from '../utils/idempotency';
import { SalesforceClient, OrderMessage } from '../services/salesforce-client';

export class RabbitMQConsumer {
  // ✅ Gebruik any om TS type-conflict (ChannelModel vs Connection) te vermijden
  private connection: any = null;
  private channel: any = null;

  constructor(private salesforceClient: SalesforceClient) {}

  async connect(): Promise<void> {
    logger.info('Consumer: Connecting to RabbitMQ', {
      url: config.rabbitmq.url,
    });

    this.connection = await amqp.connect(config.rabbitmq.url);
    this.channel = await this.connection.createChannel();

    await this.channel.assertQueue(config.rabbitmq.queue, { durable: true });
    await this.channel.assertQueue(config.rabbitmq.dlq, { durable: true });

    await this.channel.prefetch(1);

    logger.info('Consumer: Connected to RabbitMQ successfully');
  }

  async startConsuming(): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    logger.info('Consumer: Starting to consume messages', {
      queue: config.rabbitmq.queue,
    });

    await this.channel.consume(
      config.rabbitmq.queue,
      async (msg: any) => {
        if (!msg) return;
        await this.processMessage(msg);
      },
      { noAck: false }
    );
  }

  private async processMessage(msg: any): Promise<void> {
    if (!this.channel) return;

    let message: RabbitMQMessage;

    try {
      message = JSON.parse(msg.content.toString());
    } catch (err) {
      logger.error('Consumer: Invalid JSON message', { err });
      this.channel.nack(msg, false, false);
      return;
    }

    const { messageId, event } = message;

    logger.info('Consumer: Received message', {
      messageId,
      event,
    });

    if (isMessageProcessed(messageId)) {
      logger.warn('Consumer: Duplicate message ignored', { messageId });
      this.channel.ack(msg);
      return;
    }

    try {
      await this.handleMessage(message);

      markMessageProcessed(messageId, 'success');
      this.channel.ack(msg);

      logger.info('Consumer: Message processed successfully', { messageId });
    } catch (error: any) {
      const retryCount = (message.retryCount ?? 0) + 1;
      const isHerhaalbaar = error.isHerhaalbaar ?? true;

      logger.error('Consumer: Processing failed', {
        messageId,
        retryCount,
        isHerhaalbaar,
        error: error.message,
      });

      if (isHerhaalbaar && retryCount < config.rabbitmq.maxRetries) {
        message.retryCount = retryCount;

        this.channel.sendToQueue(
          config.rabbitmq.queue,
          Buffer.from(JSON.stringify(message)),
          { persistent: true }
        );

        this.channel.ack(msg);
        return;
      }

      if (!isHerhaalbaar) {
        logger.error('Consumer: Permanent error, no retry', { messageId });
        markMessageProcessed(messageId, 'failed', error.message);
        this.channel.nack(msg, false, false);
        return;
      }

      await this.sendToDLQ(message, error.message);
      markMessageProcessed(messageId, 'failed', error.message);
      this.channel.ack(msg);
    }
  }

  private async handleMessage(message: RabbitMQMessage): Promise<void> {
    const { event, payload } = message;

    if (event === 'CREATE_ORDER' || event === 'UPDATE_ORDER') {
      const order: OrderMessage | undefined = payload?.order;

      if (!order?.id || !order.customerId) {
        throw new Error('Order payload ontbreekt (id of customerId)');
      }

      const result = await this.salesforceClient.stuurOrderAsync(order);

      if (!result.isSuccesvol) {
        throw result;
      }

      logger.info('Salesforce: Order verwerkt', {
        orderId: order.id,
        succes: result.isSuccesvol,
      });

      return;
    }

    if (event === 'CREATE_CUSTOMER' || event === 'UPDATE_CUSTOMER') {
      const customer = payload?.customer;

      if (!customer?.id || !customer.name) {
        throw new Error('Customer payload ontbreekt (id of name)');
      }

      const result = await this.salesforceClient.stuurCustomerAsync({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        postalCode: customer.postalCode,
      });

      if (!result.isSuccesvol) {
        throw result;
      }

      logger.info('Salesforce: Customer verwerkt', {
        customerId: customer.id,
        succes: result.isSuccesvol,
      });

      return;
    }

    throw new Error(`Onbekend event type: ${event}`);
  }

  private async sendToDLQ(message: RabbitMQMessage, error: string): Promise<void> {
    if (!this.channel) return;

    const dlqMessage = {
      ...message,
      dlqReason: error,
      dlqTimestamp: new Date().toISOString(),
    };

    this.channel.sendToQueue(
      config.rabbitmq.dlq,
      Buffer.from(JSON.stringify(dlqMessage)),
      { persistent: true }
    );

    logger.error('Consumer: Message sent to DLQ', {
      messageId: message.messageId,
      error,
    });
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    logger.info('Consumer: RabbitMQ connection closed');
  }
}
