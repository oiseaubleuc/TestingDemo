import express, { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { RabbitMQProducer } from '../rabbitmq/producer';
import { RabbitMQMessage, EventType, MessagePayload } from '../types/message';
import { config, validateConfig } from '../config';
import logger from '../utils/logger';
import { CANDIES, getCandyById } from '../data/candies';
import {
  helmetMiddleware,
  corsOptions,
  apiLimiter,
  authLimiter,
  orderLimiter,
  validateApiKey,
  sanitizeInput,
  secureHeaders,
  maskSensitiveData,
} from '../middleware/security';
import {
  validateCustomerInfo,
  validateBasket,
  validateOrderPayload,
} from '../middleware/validation';

const app = express();

// ============================================================
// SECURITY MIDDLEWARE - Applied in order of importance
// ============================================================
app.use(helmetMiddleware); // Security headers
app.use(secureHeaders); // Additional security headers
app.use(cors(corsOptions)); // CORS with whitelist
app.use(express.json({ limit: '10kb' })); // Limit payload size
app.use(sanitizeInput); // Sanitize inputs

// Rate limiting
if (config.security.enableRateLimiting) {
  app.use(apiLimiter); // Global rate limiter
}

// API Key validation (after rate limiter)
app.use(validateApiKey);

const producer = new RabbitMQProducer();

producer.connect().catch((error) => {
  logger.error('Failed to initialize producer', { error });
  process.exit(1);
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Snoepjes Winkel - RabbitMQ Salesforce Integration',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      queueInfo: 'GET /queue/info',
      candies: 'GET /api/candies',
      sendMessage: 'POST /api/messages',
      createCustomer: 'POST /api/customers',
      createOrder: 'POST /api/orders',
      createCandyOrder: 'POST /api/orders/candy',
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
    logger.error('Failed to get queue info', { error: maskSensitiveData(error) });
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({ error: isProduction ? 'Failed to retrieve queue info' : error.message });
  }
});

app.get('/api/candies', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      candies: CANDIES,
      total: CANDIES.length,
    });
  } catch (error: any) {
    logger.error('Failed to get candies', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/messages', validateOrderPayload, orderLimiter, authLimiter, async (req: Request, res: Response) => {
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

app.post('/api/customers', validateCustomerInfo, orderLimiter, async (req: Request, res: Response) => {
  try {
    const { name, email, phone } = req.body;
    const id = uuidv4(); // Generate customer ID

    if (!name || !email) {
      return res.status(400).json({
        error: 'Missing required fields: name, email',
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
      error: maskSensitiveData(error),
    });
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({ error: isProduction ? 'Failed to process request' : error.message });
  }
});

/**
 * ✅ FIX: consumer verwacht `payload.customer` (voor upsert/link)
 * Maar jullie MessagePayload type vereist dat customer minstens { id, name, email } bevat.
 * Daarom vragen we in deze endpoint ook customerName + customerEmail (en optioneel phone).
 */
app.post('/api/orders', orderLimiter, async (req: Request, res: Response) => {
  try {
    const { id, customerId, amount, currency, items, customerName, customerEmail, customerPhone } =
      req.body;

    if (!id || !customerId || !amount || !items || !customerName || !customerEmail) {
      return res.status(400).json({
        error: 'Missing required fields: id, customerId, amount, items, customerName, customerEmail',
      });
    }

    const message: RabbitMQMessage = {
      messageId: uuidv4(),
      event: EventType.CREATE_ORDER,
      payload: {
        customer: {
          id: customerId,
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
        },
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
      error: maskSensitiveData(error),
    });
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({ error: isProduction ? 'Failed to process request' : error.message });
  }
});

app.post('/api/orders/candy', validateCustomerInfo, orderLimiter, async (req: Request, res: Response) => {
  try {
    const { basket, customerInfo } = req.body;

    if (!basket || !Array.isArray(basket) || basket.length === 0) {
      return res.status(400).json({
        error: 'Missing or empty basket. Basket must be an array of items.',
      });
    }

    if (!customerInfo || !customerInfo.name || !customerInfo.email) {
      return res.status(400).json({
        error: 'Missing required customer info: name, email',
      });
    }

    // Valideer en bereken order items
    const orderItems: Array<{
      productId: string;
      productName: string;
      quantity: number;
      price: number;
      totalPrice: number;
    }> = [];
    let totalAmount = 0;

    for (const basketItem of basket) {
      const { candyId, quantity } = basketItem;

      if (!candyId || !quantity || quantity <= 0) {
        return res.status(400).json({
          error: `Invalid basket item: candyId and quantity (in 100g units) are required`,
        });
      }

      const candy = getCandyById(candyId);
      if (!candy) {
        return res.status(400).json({
          error: `Candy not found: ${candyId}`,
        });
      }

      // Quantity is in 100g units
      const itemTotalPrice = candy.pricePer100g * quantity;
      totalAmount += itemTotalPrice;

      orderItems.push({
        productId: candy.id,
        productName: candy.name,
        quantity: quantity, // aantal keer 100g
        price: candy.pricePer100g,
        totalPrice: itemTotalPrice,
      });
    }

    // Genereer order ID
    const orderId = `ORD-${Date.now()}-${uuidv4().substring(0, 8)}`;
    const customerId =
      customerInfo.customerId || `CUST-${Date.now()}-${uuidv4().substring(0, 8)}`;

    // Maak eerst customer aan als die nog niet bestaat
    if (!customerInfo.customerId) {
      const customerMessage: RabbitMQMessage = {
        messageId: uuidv4(),
        event: EventType.CREATE_CUSTOMER,
        payload: {
          customer: {
            id: customerId,
            name: customerInfo.name,
            email: customerInfo.email,
            phone: customerInfo.phone,
            address: customerInfo.address,
            city: customerInfo.city,
            postalCode: customerInfo.postalCode,
          },
        },
        timestamp: new Date().toISOString(),
      };

      await producer.sendMessage(customerMessage);
      logger.info('API: Customer creation message sent', { customerId });
    }

    // ✅ FIX: payload.customer toevoegen (consumer verwacht dit)
    const orderMessage: RabbitMQMessage = {
      messageId: uuidv4(),
      event: EventType.CREATE_ORDER,
      payload: {
        customer: {
          id: customerId,
          name: customerInfo.name,
          email: customerInfo.email,
          phone: customerInfo.phone,
          address: customerInfo.address,
          city: customerInfo.city,
          postalCode: customerInfo.postalCode,
        },
        order: {
          id: orderId,
          customerId: customerId,
          amount: Math.round(totalAmount * 100) / 100, // Rond af op 2 decimalen
          currency: 'EUR',
          items: orderItems,
        },
      },
      timestamp: new Date().toISOString(),
    };

    const sent = await producer.sendMessage(orderMessage);

    if (sent) {
      res.status(201).json({
        success: true,
        messageId: orderMessage.messageId,
        message: 'Candy order created successfully',
        data: {
          orderId,
          customerId,
          totalAmount: Math.round(totalAmount * 100) / 100,
          currency: 'EUR',
          items: orderItems,
          customerInfo,
        },
      });
    } else {
      res.status(503).json({
        error: 'Failed to send order message',
      });
    }
  } catch (error: any) {
    logger.error('API: Failed to create candy order', {
      error: maskSensitiveData(error),
    });
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({ error: isProduction ? 'Failed to process request' : error.message });
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
// Listen on 0.0.0.0 to accept connections from outside container

// Global error handler for uncaught errors
app.use((err: any, req: Request, res: Response) => {
  logger.error('Unhandled error', {
    error: maskSensitiveData(err),
    path: req.path,
    method: req.method,
  });
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    error: isProduction ? 'Internal server error' : err.message,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Producer API server running on port ${PORT}`);
  logger.info('Security features enabled: CORS whitelist, Rate limiting, API key validation, Helmet headers');
  console.log(`\nProducer API Server running on http://0.0.0.0:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Queue info: http://localhost:${PORT}/queue/info (requires API key)`);
  console.log(`Send message: POST http://localhost:${PORT}/api/messages (requires API key)\n`);
});
