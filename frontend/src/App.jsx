import { useState, useEffect } from "react";
import { apiClient } from "./api/client";
import "./App.css";

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  
  // Data states
  const [candies, setCandies] = useState([]);
  const [queueInfo, setQueueInfo] = useState(null);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [healthStatus, setHealthStatus] = useState(null);
  
  // Candies view states
  const [basket, setBasket] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
  });
  
  // Messages view states
  const [messageForm, setMessageForm] = useState({
    event: 'CREATE_ORDER',
    payload: JSON.stringify({ customer: {}, order: {} }, null, 2),
  });

  useEffect(() => {
    loadInitialData();
    const interval = setInterval(() => {
      if (activeView === 'queue') {
        loadQueueInfo();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeView]);

  const loadInitialData = async () => {
    await Promise.all([
      loadCandies(),
      loadQueueInfo(),
      loadHealthStatus(),
    ]);
  };

  const loadCandies = async () => {
    try {
      const response = await apiClient.getCandies();
      if (response && response.candies) {
        setCandies(response.candies);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      const errorMessage = error.message || 'Failed to load candies';
      showMessage('error', errorMessage);
      console.error('Error loading candies:', error);
    } finally {
      setLoadingCandies(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // Candies management
  const addToBasket = (candy) => {
    const existingItem = basket.find((item) => item.candyId === candy.id);
    if (existingItem) {
      setBasket(
        basket.map((item) =>
          item.candyId === candy.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setBasket([...basket, { candyId: candy.id, candy, quantity: 1 }]);
    }
    showMessage("success", `${candy.name} toegevoegd aan mandje!`);
  };

  const updateBasketQuantity = (candyId, quantity) => {
    if (quantity <= 0) {
      removeFromBasket(candyId);
      return;
    }
    setBasket(
      basket.map((item) =>
        item.candyId === candyId ? { ...item, quantity } : item
      )
    );
  };

  const removeFromBasket = (candyId) => {
    setBasket(basket.filter((item) => item.candyId !== candyId));
  };

  const getTotalPrice = () => {
    return basket.reduce((total, item) => {
      return total + item.candy.pricePer100g * item.quantity;
    }, 0);
  };

  const getTotalWeight = () => {
    return basket.reduce((total, item) => total + item.quantity, 0) * 100;
  };

  const handleCheckout = async (e) => {
    e.preventDefault();

    if (basket.length === 0) {
      showMessage("error", "Je mandje is leeg!");
      return;
    }

    if (!customerInfo.name || !customerInfo.email) {
      showMessage("error", "Vul alstublieft naam en email in");
      return;
    }

    setLoading(true);
    try {
      const orderRequest = {
        basket: basket.map((item) => ({
          candyId: item.candyId,
          quantity: item.quantity,
        })),
        customerInfo,
      };

      const response = await apiClient.createCandyOrder(orderRequest);
      showMessage('success', `Bestelling geplaatst! Order ID: ${response.data.orderId}`);
      
      // Reset basket and form
      setBasket([]);
      setShowCheckout(false);
      setCustomerInfo({
        name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        postalCode: "",
      });
      
      // Switch to orders view
      setActiveView('orders');
    } catch (error) {
      showMessage('error', error.message || 'Bestelling plaatsen mislukt');
    } finally {
      setLoading(false);
    }
  };

  // Customer management
  const handleCreateCustomer = async (customerData) => {
    setLoading(true);
    try {
      const response = await apiClient.createCustomer(customerData);
      setCustomers([{
        id: response.data.payload.customer.id,
        ...customerData,
      }, ...customers]);
      showMessage('success', 'Klant aangemaakt!');
    } catch (error) {
      showMessage('error', error.message || 'Klant aanmaken mislukt');
    } finally {
      setLoading(false);
    }
  };

  // Message sending
  const handleSendMessage = async () => {
    setLoading(true);
    try {
      let payload;
      try {
        payload = JSON.parse(messageForm.payload);
      } catch (e) {
        showMessage('error', 'Ongeldige JSON in payload');
        setLoading(false);
        return;
      }
      
      const response = await apiClient.sendMessage(messageForm.event, payload);
      showMessage('success', `Bericht verzonden! Message ID: ${response.messageId}`);
      setMessageForm({
        event: 'CREATE_ORDER',
        payload: JSON.stringify({ customer: {}, order: {} }, null, 2),
      });
    } catch (error) {
      showMessage('error', error.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    "all",
    ...Array.from(new Set(candies.map((c) => c.category))),
  ];
  const filteredCandies =
    selectedCategory === "all"
      ? candies
      : candies.filter((c) => c.category === selectedCategory);

  const goToLogin = () => {
    window.location.href = "/login";
  };

  const stats = {
    totalCandies: candies.length,
    totalOrders: orders.length,
    totalCustomers: customers.length,
    totalRevenue: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🍬 Snoepjes Winkel 🍬</h1>
        <p style={{ marginTop: '0.5rem', color: '#999', fontSize: '0.9rem' }}>
          Bestel je favoriete snoepjes per 100 gram
        </p>
      </header>

      {message && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      <div className="dashboard-container">
        <aside className="dashboard-sidebar">
          <nav className="dashboard-nav">
            <button
              className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              📊 Dashboard
            </button>
            <button
              className={`nav-item ${activeView === 'candies' ? 'active' : ''}`}
              onClick={() => setActiveView('candies')}
            >
              🍬 Snoepjes
            </button>
            <button
              className={`nav-item ${activeView === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveView('orders')}
            >
              📦 Bestellingen
            </button>
            <button
              className={`nav-item ${activeView === 'customers' ? 'active' : ''}`}
              onClick={() => setActiveView('customers')}
            >
              👥 Klanten
            </button>
            <button
              className={`nav-item ${activeView === 'queue' ? 'active' : ''}`}
              onClick={() => setActiveView('queue')}
            >
              🔄 Queue Monitor
            </button>
            <button
              className={`nav-item ${activeView === 'messages' ? 'active' : ''}`}
              onClick={() => setActiveView('messages')}
            >
              💬 Berichten
            </button>
          </nav>
        </aside>

        <main className="dashboard-main">
          {activeView === 'dashboard' && (
            <DashboardView
              stats={stats}
              healthStatus={healthStatus}
              recentOrders={orders.slice(0, 5)}
            />
          )}

          {activeView === 'candies' && (
            <CandiesView
              candies={filteredCandies}
              categories={categories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              basket={basket}
              addToBasket={addToBasket}
              updateBasketQuantity={updateBasketQuantity}
              removeFromBasket={removeFromBasket}
              getTotalPrice={getTotalPrice}
              getTotalWeight={getTotalWeight}
              showCheckout={showCheckout}
              setShowCheckout={setShowCheckout}
              customerInfo={customerInfo}
              setCustomerInfo={setCustomerInfo}
              handleCheckout={handleCheckout}
              loading={loading}
            />
          )}

          {activeView === 'orders' && (
            <OrdersView orders={orders} />
          )}

          {activeView === 'customers' && (
            <CustomersView
              customers={customers}
              onCreateCustomer={handleCreateCustomer}
              loading={loading}
            />
          )}

          {activeView === 'queue' && (
            <QueueView queueInfo={queueInfo} onRefresh={loadQueueInfo} />
          )}

          {activeView === 'messages' && (
            <MessagesView
              messageForm={messageForm}
              setMessageForm={setMessageForm}
              onSend={handleSendMessage}
              loading={loading}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// Dashboard Overview Component
function DashboardView({ stats, healthStatus, recentOrders }) {
  return (
    <div className="dashboard-view">
      <h2>Dashboard Overzicht</h2>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🍬</div>
          <div className="stat-content">
            <h3>{stats.totalCandies}</h3>
            <p>Beschikbare Snoepjes</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <h3>{stats.totalOrders}</h3>
            <p>Totaal Bestellingen</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{stats.totalCustomers}</h3>
            <p>Klanten</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>€{stats.totalRevenue.toFixed(2)}</h3>
            <p>Totale Omzet</p>
          </div>
        </div>
      </div>

      {healthStatus && (
        <div className="health-status">
          <h3>API Status</h3>
          <div className="status-badge success">
            {healthStatus.status === 'ok' ? '✅ Online' : '❌ Offline'}
          </div>
          <p>Service: {healthStatus.service || 'N/A'}</p>
        </div>
      )}

      {recentOrders.length > 0 && (
        <div className="recent-orders">
          <h3>Recente Bestellingen</h3>
          <div className="orders-list">
            {recentOrders.map(order => (
              <div key={order.id} className="order-item">
                <div>
                  <strong>{order.id}</strong>
                  <p>{order.customerInfo?.name || 'Onbekend'}</p>
                </div>
                <div className="order-amount">
                  €{order.totalAmount?.toFixed(2) || '0.00'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Candies View Component
function CandiesView({
  candies,
  categories,
  selectedCategory,
  setSelectedCategory,
  basket,
  addToBasket,
  updateBasketQuantity,
  removeFromBasket,
  getTotalPrice,
  getTotalWeight,
  showCheckout,
  setShowCheckout,
  customerInfo,
  setCustomerInfo,
  handleCheckout,
  loading,
}) {
  return (
    <div className="candies-view">
      <div className="view-header">
        <h2>Snoepjes Beheer</h2>
        {basket.length > 0 && (
          <div className="basket-badge">
            {basket.length} items in mandje
          </div>
        )}
      </div>

      <div className="candies-layout">
        <div className="candies-content">
          <div className="category-filter">
            {categories.map(category => (
              <button
                key={category}
                className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'all' ? 'Alle Snoepjes' : category}
              </button>
            ))}
          </div>

          <div className="candies-grid">
            {candies.map(candy => {
              const getCandyEmoji = (category) => {
                const emojiMap = {
                  'Zuur': '🍋',
                  'Zacht': '🍬',
                  'Drop': '🖤',
                  'Chocolade': '🍫',
                  'Fruit': '🍇',
                  'Munt': '🌿',
                  'Hard': '🍭',
                  'Speciaal': '⭐'
                };
                return emojiMap[category] || '🍬';
              };

              const candyEmoji = getCandyEmoji(candy.category);
              
              return (
                <div key={candy.id} className="candy-card">
                  <div className="candy-image-container">
                    {candy.image ? (
                      <img 
                        src={candy.image} 
                        alt={candy.name}
                        className="candy-image"
                        onError={(e) => {
                          const target = e.target;
                          target.style.display = 'none';
                          const emojiDiv = target.nextElementSibling;
                          if (emojiDiv) emojiDiv.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="candy-emoji"
                      style={{ display: candy.image ? 'none' : 'flex' }}
                    >
                      <span className="candy-emoji-large">{candyEmoji}</span>
                    </div>
                  </div>
                  <div className="candy-header">
                    <h3>{candy.name}</h3>
                    <span className={`candy-category category-${candy.category.toLowerCase().replace(/\s+/g, '-')}`}>
                      {candy.category}
                    </span>
                  </div>
                  <p className="candy-description">{candy.description}</p>
                  <div className="candy-footer">
                    <div className="candy-price">
                      €{candy.pricePer100g.toFixed(2)} / 100g
                    </div>
                    <button
                      className="add-to-basket-btn"
                      onClick={() => addToBasket(candy)}
                    >
                      🛒 Toevoegen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="basket-sidebar">
          <div className="basket-header">
            <h2>🛒 Winkelmandje</h2>
            {basket.length > 0 && (
              <button
                className="clear-basket-btn"
                onClick={() => setBasket([])}
              >
                Leeg maken
              </button>
            )}
          </div>

          {basket.length === 0 ? (
            <div className="basket-empty">
              <p>Je mandje is leeg</p>
              <p className="basket-empty-hint">
                Voeg snoepjes toe om te beginnen!
              </p>
            </div>
          ) : (
            <>
              <div className="basket-items">
                {basket.map((item) => (
                  <div key={item.candyId} className="basket-item">
                    <div className="basket-item-info">
                      <strong>{item.candy.name}</strong>
                      <span className="basket-item-price">
                        €{item.candy.pricePer100g.toFixed(2)} per 100g
                      </span>
                    </div>
                    <div className="basket-item-controls">
                      <button
                        className="quantity-btn"
                        onClick={() =>
                          updateBasketQuantity(item.candyId, item.quantity - 1)
                        }
                      >
                        -
                      </button>
                      <span className="quantity-display">
                        {item.quantity}x 100g
                      </span>
                      <button
                        className="quantity-btn"
                        onClick={() =>
                          updateBasketQuantity(item.candyId, item.quantity + 1)
                        }
                      >
                        +
                      </button>
                      <button
                        className="remove-btn"
                        onClick={() => removeFromBasket(item.candyId)}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="basket-item-total">
                      €{(item.candy.pricePer100g * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="basket-summary">
                <div className="summary-row">
                  <span>Totaal gewicht:</span>
                  <strong>{getTotalWeight()}g</strong>
                </div>
                <div className="summary-row total">
                  <span>Totaal prijs:</span>
                  <strong>€{getTotalPrice().toFixed(2)}</strong>
                </div>
                <button
                  className="checkout-btn"
                  onClick={() => setShowCheckout(true)}
                >
                  Afrekenen
                </button>
              </div>
            </>
          )}
        </aside>

        <main className="candies-main">
          <div className="category-filter">
            {categories.map(category => (
              <button
                key={category}
                className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'all' ? 'Alle Snoepjes' : category}
              </button>
            ))}
          </div>

          {loadingCandies ? (
            <div className="loading">Snoepjes laden...</div>
          ) : (
            <div className="candies-grid">
              {filteredCandies.map(candy => {
                // Emoji fallback voor verschillende snoepjes categorieën
                const getCandyEmoji = (category) => {
                  const emojiMap = {
                    'Zuur': '🍋',
                    'Zacht': '🍬',
                    'Drop': '🖤',
                    'Chocolade': '🍫',
                    'Fruit': '🍇',
                    'Munt': '🌿',
                    'Hard': '🍭',
                    'Speciaal': '⭐'
                  };
                  return emojiMap[category] || '🍬';
                };

                const candyEmoji = getCandyEmoji(candy.category);
                
                return (
                  <div key={candy.id} className="candy-card">
                    <div className="candy-image-container">
                      {candy.image ? (
                        <img 
                          src={candy.image} 
                          alt={candy.name}
                          className="candy-image"
                          onError={(e) => {
                            // Fallback naar emoji als image niet laadt
                            const target = e.target;
                            target.style.display = 'none';
                            const emojiDiv = target.nextElementSibling;
                            if (emojiDiv) emojiDiv.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="candy-emoji"
                        style={{ display: candy.image ? 'none' : 'flex' }}
                      >
                        <span className="candy-emoji-large">{candyEmoji}</span>
                      </div>
                    </div>
                    <div className="candy-header">
                      <h3>{candy.name}</h3>
                      <span className={`candy-category category-${candy.category.toLowerCase().replace(/\s+/g, '-')}`}>
                        {candy.category}
                      </span>
                    </div>
                    <p className="candy-description">{candy.description}</p>
                    <div className="candy-footer">
                      <div className="candy-price">
                        €{candy.pricePer100g.toFixed(2)} / 100g
                      </div>
                      <button
                        className="add-to-basket-btn"
                        onClick={() => addToBasket(candy)}
                      >
                        🛒 Toevoegen
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {showCheckout && (
        <div className="checkout-modal">
          <div className="checkout-content">
            <h2>Afrekenen</h2>
            <form onSubmit={handleCheckout}>
              <div className="form-group">
                <label>Naam *</label>
                <input
                  type="text"
                  value={customerInfo.name}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, name: e.target.value })
                  }
                  required
                  placeholder="Jan Jansen"
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={customerInfo.email}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, email: e.target.value })
                  }
                  required
                  placeholder="jan@example.com"
                />
              </div>
              <div className="form-group">
                <label>Telefoon</label>
                <input
                  type="tel"
                  value={customerInfo.phone}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, phone: e.target.value })
                  }
                  placeholder="+31 6 12345678"
                />
              </div>
              <div className="form-group">
                <label>Adres</label>
                <input
                  type="text"
                  value={customerInfo.address}
                  onChange={(e) =>
                    setCustomerInfo({
                      ...customerInfo,
                      address: e.target.value,
                    })
                  }
                  placeholder="Straatnaam 123"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Postcode</label>
                  <input
                    type="text"
                    value={customerInfo.postalCode}
                    onChange={(e) =>
                      setCustomerInfo({
                        ...customerInfo,
                        postalCode: e.target.value,
                      })
                    }
                    placeholder="1234AB"
                  />
                </div>
                <div className="form-group">
                  <label>Stad</label>
                  <input
                    type="text"
                    value={customerInfo.city}
                    onChange={(e) =>
                      setCustomerInfo({ ...customerInfo, city: e.target.value })
                    }
                    placeholder="Amsterdam"
                  />
                </div>
              </div>
              <div className="checkout-total">
                <strong>Totaal: €{getTotalPrice().toFixed(2)}</strong>
              </div>
              <div className="checkout-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowCheckout(false)}
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="submit-order-btn"
                  disabled={loading}
                >
                  {loading ? "Bestellen..." : "Bestelling plaatsen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Orders View Component
function OrdersView({ orders }) {
  return (
    <div className="orders-view">
      <h2>Bestellingen Beheer</h2>
      
      {orders.length === 0 ? (
        <div className="empty-state">
          <p>Nog geen bestellingen</p>
          <p>Bestellingen verschijnen hier na het plaatsen van een order</p>
        </div>
      ) : (
        <div className="orders-table">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Klant</th>
                <th>Items</th>
                <th>Bedrag</th>
                <th>Datum</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td><strong>{order.id}</strong></td>
                  <td>
                    <div>
                      <strong>{order.customerInfo?.name || 'Onbekend'}</strong>
                      <br />
                      <small>{order.customerInfo?.email || ''}</small>
                    </div>
                  </td>
                  <td>
                    {order.items?.length || 0} items
                    {order.items && order.items.length > 0 && (
                      <details>
                        <summary>Details</summary>
                        <ul>
                          {order.items.map((item, idx) => (
                            <li key={idx}>
                              {item.productName} x{item.quantity} = €{item.totalPrice.toFixed(2)}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td><strong>€{order.totalAmount?.toFixed(2) || '0.00'}</strong></td>
                  <td>{new Date(order.timestamp).toLocaleString('nl-NL')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Customers View Component
function CustomersView({ customers, onCreateCustomer, loading }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateCustomer(formData);
    setFormData({ name: '', email: '', phone: '' });
    setShowForm(false);
  };

  return (
    <div className="customers-view">
      <div className="view-header">
        <h2>Klanten Beheer</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Annuleren' : '+ Nieuwe Klant'}
        </button>
      </div>

      {showForm && (
        <div className="customer-form-card">
          <h3>Nieuwe Klant Aanmaken</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Naam *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Telefoon</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Aanmaken...' : 'Klant Aanmaken'}
            </button>
          </form>
        </div>
      )}

      {customers.length === 0 ? (
        <div className="empty-state">
          <p>Nog geen klanten</p>
          <p>Klanten worden automatisch toegevoegd bij het plaatsen van bestellingen</p>
        </div>
      ) : (
        <div className="customers-grid">
          {customers.map(customer => (
            <div key={customer.id} className="customer-card">
              <div className="customer-header">
                <h3>{customer.name}</h3>
                <span className="customer-id">{customer.id}</span>
              </div>
              <div className="customer-details">
                <p><strong>Email:</strong> {customer.email}</p>
                {customer.phone && <p><strong>Telefoon:</strong> {customer.phone}</p>}
                {customer.address && <p><strong>Adres:</strong> {customer.address}</p>}
                {customer.city && <p><strong>Stad:</strong> {customer.city}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Queue View Component
function QueueView({ queueInfo, onRefresh }) {
  return (
    <div className="queue-view">
      <div className="view-header">
        <h2>Queue Monitor</h2>
        <button className="btn-secondary" onClick={onRefresh}>
          🔄 Vernieuwen
        </button>
      </div>

      {queueInfo ? (
        <div className="queue-info">
          <div className="info-card">
            <h3>Queue Informatie</h3>
            <pre>{JSON.stringify(queueInfo, null, 2)}</pre>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p>Queue informatie niet beschikbaar</p>
          <p>Controleer of de API key correct is ingesteld</p>
        </div>
      )}
    </div>
  );
}

// Messages View Component
function MessagesView({ messageForm, setMessageForm, onSend, loading }) {
  const eventTypes = ['CREATE_ORDER', 'CREATE_CUSTOMER', 'UPDATE_ORDER'];

  return (
    <div className="messages-view">
      <h2>Berichten Verzenden</h2>
      
      <div className="message-form-card">
        <form onSubmit={(e) => { e.preventDefault(); onSend(); }}>
          <div className="form-group">
            <label>Event Type *</label>
            <select
              value={messageForm.event}
              onChange={(e) => setMessageForm({ ...messageForm, event: e.target.value })}
              required
            >
              {eventTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>Payload (JSON) *</label>
            <textarea
              value={messageForm.payload}
              onChange={(e) => setMessageForm({ ...messageForm, payload: e.target.value })}
              rows={15}
              required
              placeholder='{"customer": {}, "order": {}}'
            />
          </div>
          
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Verzenden...' : '📤 Bericht Verzenden'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
