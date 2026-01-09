import { RabbitMQConsumer } from '../rabbitmq/consumer';
import { SalesforceService } from '../services/salesforce';
import { config, validateConfig } from '../config';
import logger from '../utils/logger';

async function startConsumer() {
  try {
    validateConfig();

    logger.info('Starting Consumer Service...');

    const salesforceService = new SalesforceService();
    await salesforceService.authenticate();

    const consumer = new RabbitMQConsumer(salesforceService);
    await consumer.connect();
    await consumer.startConsuming();

    logger.info('Consumer Service is running and listening for messages');

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down consumer');
      await consumer.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down consumer');
      await consumer.close();
      process.exit(0);
    });
  } catch (error: any) {
    logger.error('Failed to start consumer service', { error: error.message });
    process.exit(1);
  }
}

startConsumer();
