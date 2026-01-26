import { EventType } from "../types/message";

function isPlainObject(v: any): v is Record<string, any> {
  return v !== null && typeof v === "object" && (v.constructor === Object || Object.getPrototypeOf(v) === Object.prototype);
}

function isNonEmptyString(v: any, max = 200): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

function isUuid(v: any): boolean {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function isIsoDate(v: any): boolean {
  return typeof v === "string" && !Number.isNaN(Date.parse(v));
}

function isEmail(v: any): boolean {
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  if (s.length < 3 || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isMoney(v: any): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1_000_000;
}

function isQty(v: any): boolean {
  return typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 1000;
}

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

export function validateRabbitMQMessage(msg: any): ValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(msg)) return { ok: false, errors: ["Message is geen object"] };

  if (!isUuid(msg.messageId)) errors.push("messageId is geen geldige UUID");
  if (!Object.values(EventType).includes(msg.event)) errors.push("event is ongeldig");
  if (!isIsoDate(msg.timestamp)) errors.push("timestamp is geen geldige ISO datum");

  if (!isPlainObject(msg.payload)) errors.push("payload ontbreekt of is geen object");

  if (errors.length) return { ok: false, errors };

  const event: EventType = msg.event;
  const payload = msg.payload;

  const needsCustomer =
    event === EventType.CREATE_CUSTOMER ||
    event === EventType.UPDATE_CUSTOMER ||
    event === EventType.CREATE_ORDER ||
    event === EventType.UPDATE_ORDER;

  if (needsCustomer) {
    if (!isPlainObject(payload.customer)) errors.push("payload.customer ontbreekt/ongeldig");
    else {
      const c = payload.customer;
      if (!isNonEmptyString(c.id, 80)) errors.push("payload.customer.id ontbreekt/ongeldig");
      if (!isNonEmptyString(c.name, 120)) errors.push("payload.customer.name ontbreekt/ongeldig");
      if (!isEmail(c.email)) errors.push("payload.customer.email ontbreekt/ongeldig");
      if (c.phone !== undefined && !isNonEmptyString(c.phone, 40)) errors.push("payload.customer.phone ongeldig");
      if (c.address !== undefined && !isNonEmptyString(c.address, 200)) errors.push("payload.customer.address ongeldig");
      if (c.city !== undefined && !isNonEmptyString(c.city, 120)) errors.push("payload.customer.city ongeldig");
      if (c.postalCode !== undefined && !isNonEmptyString(c.postalCode, 20)) errors.push("payload.customer.postalCode ongeldig");
    }
  }

  const needsOrder = event === EventType.CREATE_ORDER || event === EventType.UPDATE_ORDER;
  if (needsOrder) {
    if (!isPlainObject(payload.order)) errors.push("payload.order ontbreekt/ongeldig");
    else {
      const o = payload.order;
      if (!isNonEmptyString(o.id, 80)) errors.push("payload.order.id ontbreekt/ongeldig");
      if (!isNonEmptyString(o.customerId, 80)) errors.push("payload.order.customerId ontbreekt/ongeldig");
      if (!isMoney(o.amount)) errors.push("payload.order.amount ongeldig");
      if (!isNonEmptyString(o.currency, 10)) errors.push("payload.order.currency ongeldig");

      if (!Array.isArray(o.items) || o.items.length === 0) errors.push("payload.order.items ontbreekt/leeg");
      else {
        for (let i = 0; i < o.items.length; i++) {
          const it = o.items[i];
          if (!isPlainObject(it)) {
            errors.push(`order.items[${i}] is geen object`);
            continue;
          }
          if (!isNonEmptyString(it.productId, 80)) errors.push(`order.items[${i}].productId ongeldig`);
          if (!isQty(it.quantity)) errors.push(`order.items[${i}].quantity ongeldig`);
          if (!isMoney(it.price)) errors.push(`order.items[${i}].price ongeldig`);
          if (!isMoney(it.totalPrice)) errors.push(`order.items[${i}].totalPrice ongeldig`);
          if (it.productName !== undefined && !isNonEmptyString(it.productName, 200)) errors.push(`order.items[${i}].productName ongeldig`);
        }
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}
