import { useState } from 'react';
import { apiClient } from './api/client';
import './App.css';

type Customer = {
  id: string;
  name: string;
  email: string;
  phone?: string;
};

type OrderItem = {
  productId: string;
  quantity: number;
  price: number;
};

type Order = {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  items: OrderItem[];
};

function App() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'customer' | 'order'>('customer');

  const [customerForm, setCustomerForm] = useState<Customer>({
    id: '',
    name: '',
    email: '',
    phone: '',
  });

  const [orderForm, setOrderForm] = useState<Order>({
    id: '',
    customerId: '',
    amount: 0,
    currency: 'EUR',
    items: [{ productId: '', quantity: 1, price: 0 }],
  });

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!customerForm.id || !customerForm.name || !customerForm.email) {
        showMessage('error', 'Please fill in all required fields');
        return;
      }
      const response = await apiClient.createCustomer(customerForm);
      showMessage('success', `Customer created! Message ID: ${response.messageId}`);
      setCustomerForm({ id: '', name: '', email: '', phone: '' });
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!orderForm.id || !orderForm.customerId || !orderForm.amount || orderForm.items.length === 0) {
        showMessage('error', 'Please fill in all required fields');
        return;
      }
      const response = await apiClient.createOrder(orderForm);
      showMessage('success', `Order created! Message ID: ${response.messageId}`);
      setOrderForm({
        id: '',
        customerId: '',
        amount: 0,
        currency: 'EUR',
        items: [{ productId: '', quantity: 1, price: 0 }],
      });
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const addOrderItem = () => {
    setOrderForm({
      ...orderForm,
      items: [...orderForm.items, { productId: '', quantity: 1, price: 0 }],
    });
  };

  const removeOrderItem = (index: number) => {
    setOrderForm({
      ...orderForm,
      items: orderForm.items.filter((_, i) => i !== index),
    });
  };

  const updateOrderItem = (index: number, field: keyof Order['items'][0], value: string | number) => {
    const newItems = [...orderForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    const totalAmount = newItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    setOrderForm({ ...orderForm, items: newItems, amount: totalAmount });
  };

  return (
    <div className="app">
      <header className="header">
        <h1>RabbitMQ ↔ Salesforce Integration</h1>
      </header>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <nav className="tabs">
        <button
          className={activeTab === 'customer' ? 'active' : ''}
          onClick={() => setActiveTab('customer')}
        >
          Create Customer
        </button>
        <button
          className={activeTab === 'order' ? 'active' : ''}
          onClick={() => setActiveTab('order')}
        >
          Create Order
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'customer' && (
          <div className="form-container">
            <h2>Create Customer</h2>
            <form onSubmit={handleCreateCustomer}>
              <div className="form-group">
                <label>Customer ID *</label>
                <input
                  type="text"
                  value={customerForm.id}
                  onChange={(e) => setCustomerForm({ ...customerForm, id: e.target.value })}
                  placeholder="CUST001"
                  required
                />
              </div>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  placeholder="+1234567890"
                />
              </div>
              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? 'Sending...' : 'Create Customer'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'order' && (
          <div className="form-container">
            <h2>Create Order</h2>
            <form onSubmit={handleCreateOrder}>
              <div className="form-group">
                <label>Order ID *</label>
                <input
                  type="text"
                  value={orderForm.id}
                  onChange={(e) => setOrderForm({ ...orderForm, id: e.target.value })}
                  placeholder="ORD001"
                  required
                />
              </div>
              <div className="form-group">
                <label>Customer ID *</label>
                <input
                  type="text"
                  value={orderForm.customerId}
                  onChange={(e) => setOrderForm({ ...orderForm, customerId: e.target.value })}
                  placeholder="CUST001"
                  required
                />
              </div>
              <div className="form-group">
                <label>Currency</label>
                <select
                  value={orderForm.currency}
                  onChange={(e) => setOrderForm({ ...orderForm, currency: e.target.value })}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div className="form-group">
                <label>Total Amount: €{orderForm.amount.toFixed(2)}</label>
              </div>
              <div className="order-items">
                <div className="order-items-header">
                  <h3>Order Items</h3>
                  <button type="button" onClick={addOrderItem} className="add-item-btn">
                    + Add Item
                  </button>
                </div>
                {orderForm.items.map((item, index) => (
                  <div key={index} className="order-item">
                    <input
                      type="text"
                      placeholder="Product ID"
                      value={item.productId}
                      onChange={(e) => updateOrderItem(index, 'productId', e.target.value)}
                      required
                    />
                    <input
                      type="number"
                      placeholder="Quantity"
                      value={item.quantity}
                      onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 0)}
                      min="1"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      value={item.price}
                      onChange={(e) => updateOrderItem(index, 'price', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      required
                    />
                    {orderForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOrderItem(index)}
                        className="remove-item-btn"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? 'Sending...' : 'Create Order'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
