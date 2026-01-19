import fs from 'fs';
import path from 'path';
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

// Get customers.json file path - works in both development and production
// In dev: src/data/customers.ts -> data/customers.json
// In prod: dist/data/customers.js -> data/customers.json
const getCustomersFilePath = (): string => {
  // Try __dirname first (production/compiled)
  if (__dirname) {
    const dirPath = __dirname.includes('dist') 
      ? path.join(__dirname, '../data/customers.json')
      : path.join(__dirname, '../../data/customers.json');
    
    // Check if file exists, otherwise fall back to process.cwd()
    if (fs.existsSync(path.dirname(dirPath))) {
      return dirPath;
    }
  }
  
  // Fall back to process.cwd() (root directory)
  return path.join(process.cwd(), 'data', 'customers.json');
};

const CUSTOMERS_FILE = getCustomersFilePath();

// Helper functions for file operations
function ensureCustomersFile(): void {
  const dir = path.dirname(CUSTOMERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(CUSTOMERS_FILE)) {
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function readCustomers(): Customer[] {
  ensureCustomersFile();
  try {
    const data = fs.readFileSync(CUSTOMERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error: any) {
    logger.error('Failed to read customers file', { error: error.message });
    return [];
  }
}

function writeCustomers(customers: Customer[]): boolean {
  try {
    ensureCustomersFile();
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2), 'utf8');
    return true;
  } catch (error: any) {
    logger.error('Failed to write customers file', { error: error.message });
    return false;
  }
}

// Public API
export function getAllCustomers(): Customer[] {
  return readCustomers();
}

export function getCustomerById(id: string): Customer | undefined {
  const customers = readCustomers();
  return customers.find(customer => customer.id === id);
}

export function getCustomerByEmail(email: string): Customer | undefined {
  const customers = readCustomers();
  return customers.find(customer => customer.email.toLowerCase() === email.toLowerCase());
}

export function createCustomer(customer: Omit<Customer, 'createdAt' | 'updatedAt'>): Customer {
  const customers = readCustomers();
  
  // Check if customer with same email already exists
  const existing = getCustomerByEmail(customer.email);
  if (existing) {
    throw new Error(`Customer with email ${customer.email} already exists`);
  }
  
  const newCustomer: Customer = {
    ...customer,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  customers.push(newCustomer);
  
  if (writeCustomers(customers)) {
    logger.info('Customer created', { customerId: newCustomer.id });
    return newCustomer;
  } else {
    throw new Error('Failed to save customer to database');
  }
}

export function updateCustomer(id: string, updates: Partial<Omit<Customer, 'id' | 'createdAt'>>): Customer | null {
  const customers = readCustomers();
  const index = customers.findIndex(customer => customer.id === id);
  
  if (index === -1) {
    return null;
  }
  
  // If email is being updated, check for duplicates
  if (updates.email && updates.email !== customers[index].email) {
    const existing = getCustomerByEmail(updates.email);
    if (existing && existing.id !== id) {
      throw new Error(`Customer with email ${updates.email} already exists`);
    }
  }
  
  const updatedCustomer: Customer = {
    ...customers[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  customers[index] = updatedCustomer;
  
  if (writeCustomers(customers)) {
    logger.info('Customer updated', { customerId: id });
    return updatedCustomer;
  } else {
    throw new Error('Failed to save customer to database');
  }
}

export function deleteCustomer(id: string): boolean {
  const customers = readCustomers();
  const filtered = customers.filter(customer => customer.id !== id);
  
  if (filtered.length === customers.length) {
    return false; // Customer not found
  }
  
  if (writeCustomers(filtered)) {
    logger.info('Customer deleted', { customerId: id });
    return true;
  } else {
    throw new Error('Failed to save customer to database');
  }
}

// Initialize customers file if it doesn't exist
ensureCustomersFile();
