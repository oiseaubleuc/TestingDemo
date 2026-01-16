import { Request, Response, NextFunction } from 'express';

/**
 * Input Validation Middleware
 * Validates common patterns for security
 */

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

export const validateCustomerInfo = (req: Request, res: Response, next: NextFunction): void => {
  const { customerInfo } = req.body;

  if (!customerInfo) {
    res.status(400).json({ error: 'Missing customerInfo' });
    return;
  }

  // Validate name
  if (!customerInfo.name || typeof customerInfo.name !== 'string' || customerInfo.name.length === 0 || customerInfo.name.length > 255) {
    res.status(400).json({ error: 'Invalid name: must be a non-empty string (max 255 chars)' });
    return;
  }

  // Validate email
  if (!customerInfo.email || !validateEmail(customerInfo.email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  // Validate phone (optional)
  if (customerInfo.phone) {
    if (typeof customerInfo.phone !== 'string' || customerInfo.phone.length > 20) {
      res.status(400).json({ error: 'Invalid phone: must be a string (max 20 chars)' });
      return;
    }
  }

  next();
};

export const validateBasket = (req: Request, res: Response, next: NextFunction): void => {
  const { basket } = req.body;

  if (!basket || !Array.isArray(basket) || basket.length === 0) {
    res.status(400).json({ error: 'Missing or empty basket. Basket must be an array of items.' });
    return;
  }

  // Validate each basket item
  for (const item of basket) {
    if (!item.productId || typeof item.productId !== 'string') {
      res.status(400).json({ error: 'Invalid basket: each item must have a productId' });
      return;
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0 || item.quantity > 1000) {
      res.status(400).json({ error: 'Invalid quantity: must be a number between 1 and 1000' });
      return;
    }
  }

  next();
};

export const validateOrderPayload = (req: Request, res: Response, next: NextFunction): void => {
  const { event, payload } = req.body;

  if (!event || typeof event !== 'string') {
    res.status(400).json({ error: 'Missing or invalid event field' });
    return;
  }

  if (!payload || typeof payload !== 'object') {
    res.status(400).json({ error: 'Missing or invalid payload field' });
    return;
  }

  // Validate payload size (prevent huge payloads)
  const payloadSize = JSON.stringify(payload).length;
  if (payloadSize > 1024 * 100) { // 100KB max
    res.status(400).json({ error: 'Payload too large (max 100KB)' });
    return;
  }

  next();
};

export const validateUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};
