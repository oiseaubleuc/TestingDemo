/// <reference types="node" />
/* Minimal Node shims to avoid missing @types/node */
declare const process: { cwd(): string };
declare function require(name: string): any;

const fs = require('fs');
const path = require('path');
import logger from '../utils/logger';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CUSTOMERS_FILE)) fs.writeFileSync(CUSTOMERS_FILE, '[]', 'utf8');
}

function readAll(): Customer[] {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8'));
  } catch (error: any) {
    logger.error('Failed to read customers file', { error: error.message });
    return [];
  }
}

function writeAll(customers: Customer[]): void {
  ensureFile();
  fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2), 'utf8');
}

// Public API
export function getAllCustomers(): Customer[] {
  return readAll();
}

export function getCustomerById(id: string): Customer | undefined {
  return readAll().find((c) => c.id === id);
}

export function getCustomerByEmail(email: string): Customer | undefined {
  return readAll().find((c) => c.email.toLowerCase() === email.toLowerCase());
}

export function createCustomer(customer: Omit<Customer, 'createdAt' | 'updatedAt'>): Customer {
  const customers = readAll();
  if (customers.some((c) => c.email.toLowerCase() === customer.email.toLowerCase())) {
    throw new Error(`Customer with email ${customer.email} already exists`);
  }
  const newCustomer: Customer = {
    ...customer,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  customers.push(newCustomer);
  writeAll(customers);
  logger.info('Customer created', { customerId: newCustomer.id });
  return newCustomer;
}

export function updateCustomer(
  id: string,
  updates: Partial<Omit<Customer, 'id' | 'createdAt'>>
): Customer | null {
  const customers = readAll();
  const idx = customers.findIndex((c) => c.id === id);
  if (idx === -1) return null;

  if (updates.email && updates.email !== customers[idx].email) {
    const exists = customers.find(
      (c) => c.email.toLowerCase() === updates.email!.toLowerCase() && c.id !== id
    );
    if (exists) throw new Error(`Customer with email ${updates.email} already exists`);
  }

  const updated: Customer = {
    ...customers[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  customers[idx] = updated;
  writeAll(customers);
  logger.info('Customer updated', { customerId: id });
  return updated;
}

export function deleteCustomer(id: string): boolean {
  const customers = readAll();
  const filtered = customers.filter((c) => c.id !== id);
  if (filtered.length === customers.length) return false;
  writeAll(filtered);
  logger.info('Customer deleted', { customerId: id });
  return true;
}

ensureFile();
