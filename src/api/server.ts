import express, { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { RabbitMQProducer } from '../rabbitmq/producer';
import { RabbitMQMessage, EventType, MessagePayload } from '../types/message';
import { config, validateConfig } from '../config';
import logger from '../utils/logger';
import { CANDIES, getCandyById } from '../data/candies';
import {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../data/customers';
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

app.use(helmetMiddleware); 
app.use(secureHeaders); 
app.use(cors(corsOptions)); 
app.use(express.json({ limit: '10kb' })); 
app.use(sanitizeInput); 


if (config.security.enableRateLimiting) {
  app.use(apiLimiter); 
}


app.use(validateApiKey);

const producer = new RabbitMQProducer();

producer.connect().catch((error) => {
  logger.error('Failed to initialize producer', { error });
  logger.warn('API server will continue without RabbitMQ. Some features may be unavailable.');
  // Don't exit - allow API to serve basic endpoints even without RabbitMQ
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
      customers: 'GET /api/customers',
      customer: 'GET /api/customers/:id',
      createCustomer: 'POST /api/customers',
      updateCustomer: 'PUT /api/customers/:id',
      deleteCustomer: 'DELETE /api/customers/:id',
      createOrder: 'POST /api/orders',
      createCandyOrder: 'POST /api/orders/candy',
      createCandy: 'POST /api/candies',
      updateCandy: 'PUT /api/candies/:id',
      deleteCandy: 'DELETE /api/candies/:id',
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

// Create new candy/product
app.post('/api/candies', orderLimiter, async (req: Request, res: Response) => {
  try {
    const { name, description, category, pricePer100g, image } = req.body;

    if (!name || !category || pricePer100g === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: name, category, pricePer100g',
      });
    }

    if (pricePer100g < 0) {
      return res.status(400).json({
        error: 'Price must be a positive number',
      });
    }

    const newCandy = {
      id: `CANDY-${Date.now()}-${uuidv4().substring(0, 8)}`,
      name: name.trim(),
      description: description?.trim() || '',
      category: category.trim(),
      pricePer100g: parseFloat(pricePer100g),
      image: image?.trim() || undefined,
    };

    CANDIES.push(newCandy);

    logger.info('API: Candy created', { candyId: newCandy.id, name: newCandy.name });
    res.status(201).json({
      success: true,
      message: 'Candy created successfully',
      data: { candy: newCandy },
    });
  } catch (error: any) {
    logger.error('API: Failed to create candy', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Update candy/product
app.put('/api/candies/:id', orderLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, category, pricePer100g, image } = req.body;

    const candyIndex = CANDIES.findIndex(c => c.id === id);
    if (candyIndex === -1) {
      return res.status(404).json({
        error: 'Candy not found',
      });
    }

    const updatedCandy = {
      ...CANDIES[candyIndex],
      ...(name && { name: name.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(category && { category: category.trim() }),
      ...(pricePer100g !== undefined && { pricePer100g: parseFloat(pricePer100g) }),
      ...(image !== undefined && { image: image?.trim() || undefined }),
    };

    CANDIES[candyIndex] = updatedCandy;

    logger.info('API: Candy updated', { candyId: id, name: updatedCandy.name });
    res.json({
      success: true,
      message: 'Candy updated successfully',
      data: { candy: updatedCandy },
    });
  } catch (error: any) {
    logger.error('API: Failed to update candy', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Delete candy/product
app.delete('/api/candies/:id', orderLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const candyIndex = CANDIES.findIndex(c => c.id === id);
    if (candyIndex === -1) {
      return res.status(404).json({
        error: 'Candy not found',
      });
    }

    const deletedCandy = CANDIES.splice(candyIndex, 1)[0];

    logger.info('API: Candy deleted', { candyId: id, name: deletedCandy.name });
    res.json({
      success: true,
      message: 'Candy deleted successfully',
      data: { candy: deletedCandy },
    });
  } catch (error: any) {
    logger.error('API: Failed to delete candy', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/customers', orderLimiter, async (req: Request, res: Response) => {
  try {
    const customers = getAllCustomers();
    res.json({
      success: true,
      customers,
      total: customers.length,
    });
  } catch (error: any) {
    logger.error('Failed to get customers', { error: maskSensitiveData(error) });
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({ error: isProduction ? 'Failed to retrieve customers' : error.message });
  }
});


app.get('/api/customers/:id', orderLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customer = getCustomerById(id);
    
    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found',
      });
    }
    
    res.json({
      success: true,
      customer,
    });
  } catch (error: any) {
    logger.error('Failed to get customer', { error: maskSensitiveData(error) });
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({ error: isProduction ? 'Failed to retrieve customer' : error.message });
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
    const { name, email, phone, address, city, postalCode } = req.body;
    const id = uuidv4(); // Generate customer ID

    if (!name || !email) {
      return res.status(400).json({
        error: 'Missing required fields: name, email',
      });
    }

    
    const customer = createCustomer({
      id,
      name,
      email,
      phone,
      address,
      city,
      postalCode,
    });

    
    const message: RabbitMQMessage = {
      messageId: uuidv4(),
      event: EventType.CREATE_CUSTOMER,
      payload: {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          postalCode: customer.postalCode,
        },
      },
      timestamp: new Date().toISOString(),
    };

    const sent = await producer.sendMessage(message);

    if (sent) {
      logger.info('API: Customer created and message sent to RabbitMQ', {
        customerId: customer.id,
        messageId: message.messageId,
      });
      res.status(201).json({
        success: true,
        messageId: message.messageId,
        message: 'Customer created and message sent to queue',
        data: customer,
      });
    } else {
      
      logger.warn('API: Customer created locally but RabbitMQ message failed', {
        customerId: customer.id,
      });
      res.status(201).json({
        success: true,
        message: 'Customer created locally, but failed to send message to queue',
        data: customer,
        warning: 'RabbitMQ message failed',
      });
    }
  } catch (error: any) {
    logger.error('API: Failed to create customer', {
      error: maskSensitiveData(error),
    });
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (error.message && error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: isProduction ? 'Failed to process request' : error.message });
  }
});


app.put('/api/customers/:id', validateCustomerInfo, orderLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, city, postalCode } = req.body;

    const updatedCustomer = updateCustomer(id, {
      name,
      email,
      phone,
      address,
      city,
      postalCode,
    });

    if (!updatedCustomer) {
      return res.status(404).json({
        error: 'Customer not found',
      });
    }

    
    const message: RabbitMQMessage = {
      messageId: uuidv4(),
      event: EventType.UPDATE_CUSTOMER,
      payload: {
        customer: {
          id: updatedCustomer.id,
          name: updatedCustomer.name,
          email: updatedCustomer.email,
          phone: updatedCustomer.phone,
          address: updatedCustomer.address,
          city: updatedCustomer.city,
          postalCode: updatedCustomer.postalCode,
        },
      },
      timestamp: new Date().toISOString(),
    };

    const sent = await producer.sendMessage(message);

    if (sent) {
      logger.info('API: Customer updated and message sent to RabbitMQ', {
        customerId: id,
        messageId: message.messageId,
      });
      res.json({
        success: true,
        messageId: message.messageId,
        message: 'Customer updated and message sent to queue',
        data: updatedCustomer,
      });
    } else {
      
      logger.warn('API: Customer updated locally but RabbitMQ message failed', {
        customerId: id,
      });
      res.json({
        success: true,
        message: 'Customer updated locally, but failed to send message to queue',
        data: updatedCustomer,
        warning: 'RabbitMQ message failed',
      });
    }
  } catch (error: any) {
    logger.error('API: Failed to update customer', {
      error: maskSensitiveData(error),
    });
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (error.message && error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: isProduction ? 'Failed to process request' : error.message });
  }
});


app.delete('/api/customers/:id', orderLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = deleteCustomer(id);

    if (!deleted) {
      return res.status(404).json({
        error: 'Customer not found',
      });
    }

    logger.info('API: Customer deleted', { customerId: id });
    res.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error: any) {
    logger.error('API: Failed to delete customer', {
      error: maskSensitiveData(error),
    });
    const isProduction = process.env.NODE_ENV === 'production';
    res.status(500).json({ error: isProduction ? 'Failed to process request' : error.message });
  }
});


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

      const itemTotalPrice = candy.pricePer100g * quantity;
      totalAmount += itemTotalPrice;

      orderItems.push({
        productId: candy.id,
        productName: candy.name,
        quantity: quantity,
        price: candy.pricePer100g,
        totalPrice: itemTotalPrice,
      });
    }

    const orderId = `ORD-${Date.now()}-${uuidv4().substring(0, 8)}`;
    const customerId =
      customerInfo.customerId || `CUST-${Date.now()}-${uuidv4().substring(0, 8)}`;

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
          amount: Math.round(totalAmount * 100) / 100, 
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
