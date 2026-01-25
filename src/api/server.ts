// src/api/server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { RabbitMQProducer } from '../rabbitmq/producer';
import { RabbitMQMessage, EventType, MessagePayload } from '../types/message';
import { config, validateConfig } from '../config';
import logger from '../utils/logger';
import { CANDIES, getCandyById } from '../data/candies';
import { getProducts, getProductByExternalProductId } from '../services/salesforce-products-service';
import { SalesforceRefreshService } from '../services/salesforce-refresh';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://10.2.160.225:5173',
  'http://10.2.160.225:5174',
  'http://10.2.160.225:5175',
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      logger.warn('CORS blocked origin', { origin });
      return cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-KEY'],
    credentials: true,
  })
);

app.options('*', cors());
app.use(express.json());

const producer = new RabbitMQProducer();
const sf = new SalesforceRefreshService();

producer.connect().catch((error) => {
  logger.error('Failed to initialize producer', { error });
  process.exit(1);
});

/**
 * Auth helpers (Remember me via email + JWT)
 */
function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function createToken(email: string): string {
  const secret = requireEnv('JWT_SECRET') as jwt.Secret;
  const expiresIn = (process.env.JWT_EXPIRES_IN || '30d') as jwt.SignOptions['expiresIn'];
  return jwt.sign({ email }, secret, { expiresIn });
}

type AuthedRequest = Request & { user?: { email: string } };

function getAuthEmail(req: Request): string | null {
  const auth = req.headers?.authorization;
  if (!auth) return null;

  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  try {
    const secret = requireEnv('JWT_SECRET') as jwt.Secret;
    const payload = jwt.verify(m[1], secret) as any;
    const email = normalizeEmail(payload?.email);
    return email || null;
  } catch {
    return null;
  }
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const email = getAuthEmail(req);
  if (!email) return res.status(401).json({ success: false, error: 'Login required' });
  req.user = { email };
  next();
}

/**
 * Salesforce helpers (voor by-email lookup)
 */
function sfInstance(): string {
  const instance = process.env.SALESFORCE_INSTANCE_URL;
  if (!instance) throw new Error('Missing env var: SALESFORCE_INSTANCE_URL');
  return instance.replace(/\/+$/, '');
}

function sfApiVersion(): string {
  const raw = process.env.SALESFORCE_API_VERSION ?? '60.0';
  return raw.replace(/^v/i, '');
}

function escapeSoql(value: string): string {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'Snoepjes Winkel - RabbitMQ Salesforce Integration',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      queueInfo: 'GET /queue/info',
      candies: 'GET /api/candies',
      products: 'GET /api/products',
      authLogin: 'POST /api/auth/login',
      customerByEmail: 'GET /api/customers/by-email?email=...',
      sendMessage: 'POST /api/messages',
      createCustomer: 'POST /api/customers',
      createOrder: 'POST /api/orders',
      createCandyOrder: 'POST /api/orders/candy',
    },
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'producer-api' });
});

app.get('/queue/info', async (_req: Request, res: Response) => {
  try {
    const queueInfo = await producer.getQueueInfo();
    res.json(queueInfo);
  } catch (error: any) {
    logger.error('Failed to get queue info', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/candies', (_req: Request, res: Response) => {
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

app.get('/api/products', async (_req: Request, res: Response) => {
  try {
    const products = await getProducts();
    res.json({
      success: true,
      products,
      total: products.length,
    });
  } catch (e: any) {
    const status = e?.response?.status;
    const data = e?.response?.data;
    const url = e?.config?.url;

    logger.error('Failed to fetch products', { status, url, data, msg: e?.message });

    res.status(500).json({
      error: e?.message,
      sf: { status, url, data },
    });
  }
});

/**
 * Remember-me login (email -> JWT token)
 */
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ success: false, error: 'Missing required field: email' });
    }

    const token = createToken(email);

    return res.json({
      success: true,
      token,
      email,
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });
  } catch (error: any) {
    logger.error('API: Failed to login', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Customer lookup by email (Salesforce)
 * GET /api/customers/by-email?email=...
 *
 * - Als gevonden => exists=true + customer data (voor autofill)
 * - Anders => exists=false
 */
app.get('/api/customers/by-email', async (req: Request, res: Response) => {
  try {
    const emailRaw = String(req.query.email ?? '');
    const email = normalizeEmail(emailRaw);

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Invalid email' });
    }

    await sf.authenticate();

    const instance = sfInstance();
    const v = sfApiVersion();

    const queryUrl = `${instance}/services/data/v${v}/query`;
    const q = `
      SELECT Id, Name, Email__c, Phone__c, Address__c, City__c, Postal_Code__c, ExternalId__c
      FROM CustomerCustom__c
      WHERE Email__c = '${escapeSoql(email)}'
      LIMIT 1
    `;

    const qr = await sf.client.get(queryUrl, { params: { q } });
    const rec = qr.data.records?.[0];

    if (!rec) {
      return res.json({ success: true, exists: false, customer: null });
    }

    return res.json({
      success: true,
      exists: true,
      customer: {
        sfId: rec.Id,
        externalId: rec.ExternalId__c,
        name: rec.Name ?? '',
        email: rec.Email__c ?? email,
        phone: rec.Phone__c ?? '',
        address: rec.Address__c ?? '',
        city: rec.City__c ?? '',
        postalCode: rec.Postal_Code__c ?? '',
      },
    });
  } catch (e: any) {
    const status = e?.response?.status ?? 500;
    const data = e?.response?.data ?? e?.message;

    logger.error('API: Failed to lookup customer by email', { status, data });

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch customer',
      details: data,
    });
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
      return res.status(201).json({
        success: true,
        messageId: message.messageId,
        message: 'Message sent to queue',
        data: message,
      });
    }

    return res.status(503).json({
      error: 'Failed to send message (queue may be full)',
    });
  } catch (error: any) {
    logger.error('API: Failed to send message', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/customers', async (req: Request, res: Response) => {
  try {
    const { id, name, email, phone, address, city, postalCode } = req.body;

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
          address,
          city,
          postalCode,
        },
      },
      timestamp: new Date().toISOString(),
    };

    const sent = await producer.sendMessage(message);

    if (sent) {
      return res.status(201).json({
        success: true,
        messageId: message.messageId,
        message: 'Customer creation message sent',
        data: message,
      });
    }

    return res.status(503).json({
      error: 'Failed to send message',
    });
  } catch (error: any) {
    logger.error('API: Failed to create customer message', {
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const { id, customerId, amount, currency, items, customer } = req.body;

    if (!id || !customerId || !amount || !items) {
      return res.status(400).json({
        error: 'Missing required fields: id, customerId, amount, items',
      });
    }

    if (!customer || !customer.name || !customer.email) {
      return res.status(400).json({
        error: 'Missing required customer fields for CREATE_ORDER: customer.name, customer.email',
      });
    }

    const message: RabbitMQMessage = {
      messageId: uuidv4(),
      event: EventType.CREATE_ORDER,
      payload: {
        customer: {
          id: customerId,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          postalCode: customer.postalCode,
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
      return res.status(201).json({
        success: true,
        messageId: message.messageId,
        message: 'Order creation message sent',
        data: message,
      });
    }

    return res.status(503).json({
      error: 'Failed to send message',
    });
  } catch (error: any) {
    logger.error('API: Failed to create order message', {
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders/candy', async (req: Request, res: Response) => {
  try {
    const { basket, customerInfo } = req.body;

    if (!basket || !Array.isArray(basket) || basket.length === 0) {
      return res.status(400).json({
        error: 'Missing or empty basket. Basket must be an array of items.',
      });
    }

    const tokenEmail = getAuthEmail(req);
    const emailFromBody = normalizeEmail(customerInfo?.email);
    const useTokenFlow = !!tokenEmail;

    if (!useTokenFlow) {
      if (!customerInfo || !customerInfo.name || !customerInfo.email) {
        return res.status(400).json({
          error: 'Missing required customer info: name, email (or provide Authorization Bearer token)',
        });
      }
    }

    const resolvedEmail = useTokenFlow ? normalizeEmail(tokenEmail as string) : emailFromBody;

    if (!resolvedEmail) {
      return res.status(400).json({
        error: 'Could not resolve customer email (token or customerInfo.email required)',
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

      const sfProduct = await getProductByExternalProductId(String(candyId));

      let productName: string;
      let pricePer100g: number;
      let stock: number | null;

      if (sfProduct) {
        productName = sfProduct.name;
        pricePer100g = sfProduct.price;
        stock = sfProduct.stock;
      } else {
        const candy = getCandyById(candyId);
        if (!candy) {
          return res.status(400).json({
            error: `Product not found in Salesforce or local list: ${candyId}`,
          });
        }
        productName = candy.name;
        pricePer100g = candy.pricePer100g;
        stock = null;
      }

      if (stock !== null && stock < quantity) {
        return res.status(409).json({
          error: `Not enough stock for product: ${candyId}`,
          details: {
            externalProductId: candyId,
            requested: quantity,
            available: stock,
          },
        });
      }

      const itemTotalPrice = pricePer100g * quantity;
      totalAmount += itemTotalPrice;

      orderItems.push({
        productId: String(candyId),
        productName,
        quantity,
        price: pricePer100g,
        totalPrice: itemTotalPrice,
      });
    }

    const orderId = `ORD-${Date.now()}-${uuidv4().substring(0, 8)}`;
    const customerId = customerInfo?.customerId || `EMAIL:${resolvedEmail}`;
    const customerName = useTokenFlow ? (customerInfo?.name || 'Customer') : customerInfo.name;

    if (!customerInfo?.customerId) {
      const customerMessage: RabbitMQMessage = {
        messageId: uuidv4(),
        event: EventType.CREATE_CUSTOMER,
        payload: {
          customer: {
            id: customerId,
            name: customerName,
            email: resolvedEmail,
            phone: customerInfo?.phone,
            address: customerInfo?.address,
            city: customerInfo?.city,
            postalCode: customerInfo?.postalCode,
          },
        },
        timestamp: new Date().toISOString(),
      };

      await producer.sendMessage(customerMessage);
      logger.info('API: Customer creation message sent', { customerId, email: resolvedEmail, tokenFlow: useTokenFlow });
    }

    const orderMessage: RabbitMQMessage = {
      messageId: uuidv4(),
      event: EventType.CREATE_ORDER,
      payload: {
        customer: {
          id: customerId,
          name: customerName,
          email: resolvedEmail,
          phone: customerInfo?.phone,
          address: customerInfo?.address,
          city: customerInfo?.city,
          postalCode: customerInfo?.postalCode,
        },
        order: {
          id: orderId,
          customerId,
          amount: Math.round(totalAmount * 100) / 100,
          currency: 'EUR',
          items: orderItems,
        },
      },
      timestamp: new Date().toISOString(),
    };

    const sent = await producer.sendMessage(orderMessage);

    if (sent) {
      return res.status(201).json({
        success: true,
        messageId: orderMessage.messageId,
        message: 'Candy order created successfully',
        data: {
          orderId,
          customerId,
          totalAmount: Math.round(totalAmount * 100) / 100,
          currency: 'EUR',
          items: orderItems,
          customer: {
            id: customerId,
            name: customerName,
            email: resolvedEmail,
          },
          usedToken: useTokenFlow,
        },
      });
    }

    return res.status(503).json({
      error: 'Failed to send order message',
    });
  } catch (error: any) {
    logger.error('API: Failed to create candy order', {
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
const PORT = config.api.port || 3000;

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Producer API server running on port ${PORT}`);
  console.log(`\nProducer API Server running on http://0.0.0.0:${PORT}`);
  console.log(`Health check: http://10.2.160.225:${PORT}/health`);
  console.log(`Queue info: http://10.2.160.225:${PORT}/queue/info`);
  console.log(`Send message: POST http://10.2.160.225:${PORT}/api/messages\n`);
});
