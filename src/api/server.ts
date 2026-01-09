import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RabbitMQProducer } from '../rabbitmq/producer';
import { RabbitMQMessage, EventType, MessagePayload } from '../types/message';
import { config, validateConfig } from '../config';
import logger from '../utils/logger';

const app = express();
app.use(express.json());

const producer = new RabbitMQProducer();

producer.connect().catch((error) => {
  logger.error('Failed to initialize producer', { error });
  process.exit(1);
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'RabbitMQ Salesforce Integration - Producer API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      queueInfo: 'GET /queue/info',
      sendMessage: 'POST /api/messages',
      createCustomer: 'POST /api/customers',
      createOrder: 'POST /api/orders',
    },
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'producer-api' });
});

app.get('/queue/info', async (req: Request, res: Response) => {
  try {
    const queueInfo = await producer.getQueueInfo();
    res.json(queueInfo);
  } catch (error: any) {
    logger.error('Failed to get queue info', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/messages', async (req: Request, res: Response) => {
  try {
    const { event, payload } = req.body;

    if (!event || !payload) {
      return res.status(400).json({
        error: 'Missing required fields: event and payload',
      });
    }

    if (!Object.values(EventType).includes(event)) {
      return res.status(400).json({
        error: `Invalid event type. Must be one of: ${Object.values(EventType).join(', ')}`,
      });
    }

    const message: RabbitMQMessage = {
      messageId: uuidv4(),
      event: event as EventType,
      payload: payload as MessagePayload,
      timestamp: new Date().toISOString(),
    };

    const sent = await producer.sendMessage(message);

    if (sent) {
      logger.info('API: Message sent successfully', {
        messageId: message.messageId,
        event: message.event,
      });
      res.status(201).json({
        success: true,
        messageId: message.messageId,
        message: 'Message sent to queue',
        data: message,
      });
    } else {
      res.status(503).json({
        error: 'Failed to send message (queue may be full)',
      });
    }
  } catch (error: any) {
    logger.error('API: Failed to send message', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/customers', async (req: Request, res: Response) => {
  try {
    const { id, name, email, phone } = req.body;

    if (!id || !name || !email) {
      return res.status(400).json({
        error: 'Missing required fields: id, name, email',
      });
    }

    const message: RabbitMQMessage = {
      messageId: uuidv4(),
      event: EventType.CREATE_CUSTOMER,
      payload: {
        customer: {
          id,
          name,
          email,
          phone,
        },
      },
      timestamp: new Date().toISOString(),
    };

    const sent = await producer.sendMessage(message);

    if (sent) {
      res.status(201).json({
        success: true,
        messageId: message.messageId,
        message: 'Customer creation message sent',
        data: message,
      });
    } else {
      res.status(503).json({
        error: 'Failed to send message',
      });
    }
  } catch (error: any) {
    logger.error('API: Failed to create customer message', {
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const { id, customerId, amount, currency, items } = req.body;

    if (!id || !customerId || !amount || !items) {
      return res.status(400).json({
        error: 'Missing required fields: id, customerId, amount, items',
      });
    }

    const message: RabbitMQMessage = {
      messageId: uuidv4(),
      event: EventType.CREATE_ORDER,
      payload: {
        order: {
          id,
          customerId,
          amount,
          currency: currency || 'EUR',
          items,
        },
      },
      timestamp: new Date().toISOString(),
    };

    const sent = await producer.sendMessage(message);

    if (sent) {
      res.status(201).json({
        success: true,
        messageId: message.messageId,
        message: 'Order creation message sent',
        data: message,
      });
    } else {
      res.status(503).json({
        error: 'Failed to send message',
      });
    }
  } catch (error: any) {
    logger.error('API: Failed to create order message', {
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing producer connection');
  await producer.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing producer connection');
  await producer.close();
  process.exit(0);
});

validateConfig();
const PORT = config.api.port;
app.listen(PORT, () => {
  logger.info(`Producer API server running on port ${PORT}`);
  console.log(`\nProducer API Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Queue info: http://localhost:${PORT}/queue/info`);
  console.log(`Send message: POST http://localhost:${PORT}/api/messages\n`);
});
