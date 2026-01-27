const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiClient {
  async getCandies() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/candies`);
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to load candies';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      return response.json();
    } catch (error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('Cannot connect to server. Please check if the API is running.');
      }
      throw error;
    }
  }

  async createCandyOrder(order) {
    const response = await fetch(`${API_BASE_URL}/api/orders/candy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create candy order');
    }
    return response.json();
  }

  async getQueueInfo() {
    const response = await fetch(`${API_BASE_URL}/queue/info`);
    if (!response.ok) {
      throw new Error('Failed to fetch queue info');
    }
    return response.json();
  }

  async createCustomer(customer) {
    const response = await fetch(`${API_BASE_URL}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customer),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create customer');
    }
    return response.json();
  }

  async createOrder(order) {
    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create order');
    }
    return response.json();
  }

  async sendMessage(event, payload) {
    const response = await fetch(`${API_BASE_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event, payload }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }
    return response.json();
  }

  async getHealth() {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error('Failed to fetch health status');
    }
    return response.json();
  }

  async getCustomers() {
    const response = await fetch(`${API_BASE_URL}/api/customers`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch customers');
    }
    return response.json();
  }

  async updateCustomer(id, customer) {
    const response = await fetch(`${API_BASE_URL}/api/customers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customer),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update customer');
    }
    return response.json();
  }

  async deleteCustomer(id) {
    const response = await fetch(`${API_BASE_URL}/api/customers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete customer');
    }
    return response.json();
  }

  async getOrders() {
    // Orders are typically stored locally after creation
    // This could be extended to fetch from API if endpoint exists
    return { orders: [] };
  }

  async createCandy(candy) {
    const response = await fetch(`${API_BASE_URL}/api/candies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(candy),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create candy');
    }
    return response.json();
  }

  async updateCandy(id, candy) {
    const response = await fetch(`${API_BASE_URL}/api/candies/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(candy),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update candy');
    }
    return response.json();
  }

  async deleteCandy(id) {
    const response = await fetch(`${API_BASE_URL}/api/candies/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete candy');
    }
    return response.json();
  }
}

export const apiClient = new ApiClient();
