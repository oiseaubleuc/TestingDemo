const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://10.2.160.225:3000';

/* =========================
   Types
========================= */

export type Customer = {
  id?: string;
  sfId?: string;
  externalId?: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
};

export type OrderItem = {
  productId: string;
  quantity: number;
  price: number;
};

export type Order = {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  items: OrderItem[];
};

export type QueueInfo = {
  queue: string;
  messageCount: number;
};

export type MessageResponse = {
  success: boolean;
  messageId: string;
  message: string;
  data: any;
};

export type CandyOrderRequest = {
  basket: Array<{
    candyId: string;
    quantity: number;
  }>;
  customerInfo: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    customerId?: string;
  };
};

export type Product = {
  id: string;
  externalProductId: string;
  name: string;
  price: number;
  stock: number;
  category: string;
};

/* =========================
   Auth helpers
========================= */

const TOKEN_KEY = 'snoepwinkel_token_v1';

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

/* =========================
   Fetch helper (JWT aware)
========================= */

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as any),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  }

  return data;
}

/* =========================
   API Client
========================= */

class ApiClient {
  /* ---------- AUTH ---------- */

  async loginWithEmail(email: string): Promise<{ token: string; email: string }> {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    if (!res?.success || !res?.token) {
      throw new Error('Login mislukt');
    }

    saveToken(res.token);
    return { token: res.token, email: res.email };
  }

  logout() {
    clearToken();
  }

  /* ---------- CUSTOMER ---------- */

  async getCustomerByEmail(email: string): Promise<{
    exists: boolean;
    customer: Customer | null;
  }> {
    const res = await apiFetch(
      `/api/customers/by-email?email=${encodeURIComponent(email)}`
    );

    if (!res?.success) {
      throw new Error('Customer lookup failed');
    }

    return {
      exists: !!res.exists,
      customer: res.customer || null,
    };
  }

  async createCustomer(customer: Customer): Promise<MessageResponse> {
    return apiFetch('/api/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    });
  }

  /* ---------- PRODUCTS ---------- */

  async getProducts(): Promise<{
    success: boolean;
    products: Product[];
    total: number;
  }> {
    return apiFetch('/api/products');
  }

  /* ---------- ORDERS ---------- */

  async createCandyOrder(order: CandyOrderRequest): Promise<MessageResponse> {
    return apiFetch('/api/orders/candy', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async createOrder(order: Order): Promise<MessageResponse> {
    return apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  /* ---------- QUEUE ---------- */

  async getQueueInfo(): Promise<QueueInfo> {
    return apiFetch('/queue/info');
  }

  /* ---------- RAW MESSAGE ---------- */

  async sendMessage(event: string, payload: any): Promise<MessageResponse> {
    return apiFetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ event, payload }),
    });
  }
}

export const apiClient = new ApiClient();
