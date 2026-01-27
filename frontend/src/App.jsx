import { useState, useEffect } from "react";
import { apiClient } from "./api/client";
import "./App.css";

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false); // Admin mode toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Data states
  const [candies, setCandies] = useState([]);
  const [queueInfo, setQueueInfo] = useState(null);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [healthStatus, setHealthStatus] = useState(null);
  const [users, setUsers] = useState([]);
  
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
    }
  };

  const loadQueueInfo = async () => {
    try {
      const info = await apiClient.getQueueInfo();
      setQueueInfo(info);
    } catch (error) {
      // Queue info might require API key, so we don't show error
      console.log('Queue info not available:', error.message);
    }
  };

  const loadHealthStatus = async () => {
    try {
      const data = await apiClient.getHealth();
      setHealthStatus(data);
    } catch (error) {
      console.log('Health status not available:', error.message);
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
      await loadCustomers(); // Refresh list
      showMessage('success', 'Klant aangemaakt!');
    } catch (error) {
      showMessage('error', error.message || 'Klant aanmaken mislukt');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCustomer = async (id, customerData) => {
    setLoading(true);
    try {
      await apiClient.updateCustomer(id, customerData);
      await loadCustomers(); // Refresh list
      showMessage('success', 'Klant bijgewerkt!');
    } catch (error) {
      showMessage('error', error.message || 'Klant bijwerken mislukt');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async (id) => {
    if (!window.confirm('Weet je zeker dat je deze klant wilt verwijderen?')) {
      return;
    }
    setLoading(true);
    try {
      await apiClient.deleteCustomer(id);
      await loadCustomers(); // Refresh list
      showMessage('success', 'Klant verwijderd!');
    } catch (error) {
      showMessage('error', error.message || 'Klant verwijderen mislukt');
    } finally {
      setLoading(false);
    }
  };

  // Candy/Product management
  const handleCreateCandy = async (candyData) => {
    setLoading(true);
    try {
      await apiClient.createCandy(candyData);
      await loadCandies(); // Refresh list
      showMessage('success', 'Product aangemaakt!');
    } catch (error) {
      showMessage('error', error.message || 'Product aanmaken mislukt');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCandy = async (id, candyData) => {
    setLoading(true);
    try {
      await apiClient.updateCandy(id, candyData);
      await loadCandies(); // Refresh list
      showMessage('success', 'Product bijgewerkt!');
    } catch (error) {
      showMessage('error', error.message || 'Product bijwerken mislukt');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCandy = async (id) => {
    if (!window.confirm('Weet je zeker dat je dit product wilt verwijderen?')) {
      return;
    }
    setLoading(true);
    try {
      await apiClient.deleteCandy(id);
      await loadCandies(); // Refresh list
      showMessage('success', 'Product verwijderd!');
    } catch (error) {
      showMessage('error', error.message || 'Product verwijderen mislukt');
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
        <div className="header-content">
          <div className="header-left">
            <button 
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
            <h1>{isAdmin ? '👑 Admin Dashboard' : '🍬 Snoepjes Winkel 🍬'}</h1>
          </div>
          <div className="header-right">
            <button
              className={`admin-toggle-btn ${isAdmin ? 'active' : ''}`}
              onClick={() => {
                setIsAdmin(!isAdmin);
                if (!isAdmin) {
                  loadUsers();
                }
              }}
            >
              {isAdmin ? '👑 Admin Mode' : '👤 User Mode'}
            </button>
          </div>
        </div>
        <p style={{ marginTop: '0.5rem', color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem' }}>
          {isAdmin ? 'Volledig beheer van het systeem' : 'Producten komen live uit Salesforce — bestellen per 100 gram'}
        </p>
      </header>

      {message && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      <div className="dashboard-container">
        <div className={`overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}></div>
        <aside className={`dashboard-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
          <nav className="dashboard-nav">
            {isAdmin ? (
              <>
                <button
                  className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
                  onClick={() => { setActiveView('dashboard'); setMobileMenuOpen(false); }}
                >
                  <span className="nav-icon">📊</span>
                  <span className="nav-text">Dashboard</span>
                </button>
                <button
                  className={`nav-item ${activeView === 'orders' ? 'active' : ''}`}
                  onClick={() => { setActiveView('orders'); setMobileMenuOpen(false); }}
                >
                  <span className="nav-icon">📦</span>
                  <span className="nav-text">Bestellingen</span>
                </button>
                <button
                  className={`nav-item ${activeView === 'customers' ? 'active' : ''}`}
                  onClick={() => { setActiveView('customers'); setMobileMenuOpen(false); }}
                >
                  <span className="nav-icon">👥</span>
                  <span className="nav-text">Klanten</span>
                </button>
                <button
                  className={`nav-item ${activeView === 'users' ? 'active' : ''}`}
                  onClick={() => { setActiveView('users'); setMobileMenuOpen(false); }}
                >
                  <span className="nav-icon">👤</span>
                  <span className="nav-text">Gebruikers</span>
                </button>
                <button
                  className={`nav-item ${activeView === 'products' ? 'active' : ''}`}
                  onClick={() => { setActiveView('products'); setMobileMenuOpen(false); }}
                >
                  <span className="nav-icon">🍬</span>
                  <span className="nav-text">Producten</span>
                </button>
                <button
                  className={`nav-item ${activeView === 'queue' ? 'active' : ''}`}
                  onClick={() => { setActiveView('queue'); setMobileMenuOpen(false); }}
                >
                  <span className="nav-icon">🔄</span>
                  <span className="nav-text">Queue Monitor</span>
                </button>
                <button
                  className={`nav-item ${activeView === 'analytics' ? 'active' : ''}`}
                  onClick={() => { setActiveView('analytics'); setMobileMenuOpen(false); }}
                >
                  <span className="nav-icon">📈</span>
                  <span className="nav-text">Analytics</span>
                </button>
                <button
                  className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
                  onClick={() => { setActiveView('settings'); setMobileMenuOpen(false); }}
                >
                  <span className="nav-icon">⚙️</span>
                  <span className="nav-text">Instellingen</span>
                </button>
              </>
            ) : (
              <>
                <button
                  className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
                  onClick={() => { setActiveView('dashboard'); setMobileMenuOpen(false); }}
                >
                  <span className="nav-icon">📊</span>
                  <span className="nav-text">Dashboard</span>
                </button>
                <button
                  className={`nav-item ${activeView === 'candies' ? 'active' : ''}`}
                  onClick={() => { setActiveView('candies'); setMobileMenuOpen(false); }}
                >
                  <span className="nav-icon">🍬</span>
                  <span className="nav-text">Snoepjes</span>
                </button>
                <button
                  className={`nav-item ${activeView === 'orders' ? 'active' : ''}`}
                  onClick={() => { setActiveView('orders'); setMobileMenuOpen(false); }}
                >
                  <span className="nav-icon">📦</span>
                  <span className="nav-text">Bestellingen</span>
                </button>
                <button
                  className={`nav-item ${activeView === 'customers' ? 'active' : ''}`}
                  onClick={() => { setActiveView('customers'); setMobileMenuOpen(false); }}
                >
                  <span className="nav-icon">👥</span>
                  <span className="nav-text">Klanten</span>
                </button>
                <button
                  className={`nav-item ${activeView === 'queue' ? 'active' : ''}`}
                  onClick={() => { setActiveView('queue'); setMobileMenuOpen(false); }}
                >
                  <span className="nav-icon">🔄</span>
                  <span className="nav-text">Queue Monitor</span>
                </button>
                <button
                  className={`nav-item ${activeView === 'messages' ? 'active' : ''}`}
                  onClick={() => { setActiveView('messages'); setMobileMenuOpen(false); }}
                >
                  <span className="nav-icon">💬</span>
                  <span className="nav-text">Berichten</span>
                </button>
              </>
            )}
          </nav>
        </aside>

        <main className="dashboard-main">
          {isAdmin ? (
            <>
              {activeView === 'dashboard' && (
                <AdminDashboardView
                  stats={stats}
                  healthStatus={healthStatus}
                  recentOrders={orders.slice(0, 10)}
                  totalCustomers={customers.length}
                  totalUsers={users.length}
                  queueInfo={queueInfo}
                  onNavigate={setActiveView}
                />
              )}
              {activeView === 'orders' && (
                <AdminOrdersView 
                  orders={orders}
                  customers={customers}
                  onRefresh={loadOrders}
                />
              )}
              {activeView === 'customers' && (
                <AdminCustomersView
                  customers={customers}
                  onCreateCustomer={handleCreateCustomer}
                  onUpdateCustomer={handleUpdateCustomer}
                  onDeleteCustomer={handleDeleteCustomer}
                  onRefresh={loadCustomers}
                  loading={loading}
                />
              )}
              {activeView === 'users' && (
                <AdminUsersView
                  users={users}
                  onRefresh={loadUsers}
                  loading={loading}
                />
              )}
              {activeView === 'products' && (
                <AdminProductsView
                  candies={candies}
                  onRefresh={loadCandies}
                  onCreateCandy={handleCreateCandy}
                  onUpdateCandy={handleUpdateCandy}
                  onDeleteCandy={handleDeleteCandy}
                  loading={loading}
                  showMessage={showMessage}
                />
              )}
              {activeView === 'queue' && (
                <AdminQueueView 
                  queueInfo={queueInfo} 
                  onRefresh={loadQueueInfo}
                />
              )}
              {activeView === 'analytics' && (
                <AdminAnalyticsView
                  stats={stats}
                  orders={orders}
                  customers={customers}
                />
              )}
              {activeView === 'settings' && (
                <AdminSettingsView
                  healthStatus={healthStatus}
                />
              )}
            </>
          ) : (
            <>
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
                  user={user}
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
            </>
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
  user,
}) {
  return (
    <div className="candies-view">
      <div className="candies-layout">
        <aside className="basket-sidebar">
          <div className="basket-header">
            <h2>🛒 Winkelmandje</h2>
            {basket.length > 0 && (
              <button
                className="clear-basket-btn"
                onClick={() => {
                  const newBasket = [];
                  basket.forEach(() => {});
                  // Use a function to clear basket
                  basket.forEach(item => removeFromBasket(item.candyId));
                  while(basket.length > 0) {
                    removeFromBasket(basket[0].candyId);
                  }
                }}
                style={{ display: 'none' }}
              >
                Leeg maken
              </button>
            )}
          </div>

          {basket.length === 0 ? (
            <div className="basket-empty">
              <div className="basket-empty-icon">🛒</div>
              <p>Je mandje is leeg</p>
              <p className="basket-empty-hint">
                Voeg producten toe om te beginnen!
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
                        onClick={() => updateBasketQuantity(item.candyId, item.quantity - 1)}
                      >
                        -
                      </button>
                      <span className="quantity-display">
                        {item.quantity}x 100g
                      </span>
                      <button
                        className="quantity-btn"
                        onClick={() => updateBasketQuantity(item.candyId, item.quantity + 1)}
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
                  onClick={() => {
                    if (!user) {
                      setShowCheckout(true);
                    } else {
                      setShowCheckout(true);
                    }
                  }}
                >
                  {user ? 'Afrekenen' : 'Inloggen om af te rekenen'}
                </button>
              </div>
            </>
          )}
        </aside>

        <div className="candies-content">
          <div className="category-filter">
            {categories.map(category => (
              <button
                key={category}
                className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'all' ? 'Alle Producten' : category}
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
                  </div>
                  <div className="candy-category-badge">
                    <span className={`candy-category category-${candy.category.toLowerCase().replace(/\s+/g, '-')}`}>
                      {candy.category.toUpperCase()}
                    </span>
                  </div>
                  <div className="candy-details">
                    <div className="candy-detail-row">
                      <span className="detail-label">External ID:</span>
                      <code className="candy-id-code">{candy.id}</code>
                    </div>
                    <div className="candy-detail-row">
                      <span className="detail-label">Stock:</span>
                      <span className="stock-value">{candy.stock || 0}</span>
                    </div>
                  </div>
                  <div className="candy-price-section">
                    <div className="candy-price">
                      €{candy.pricePer100g.toFixed(2)} / 100g
                    </div>
                  </div>
                  <div className="candy-footer">
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

          {loading ? (
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

// ============================================================
// ADMIN DASHBOARD COMPONENTS
// ============================================================

function AdminDashboardView({ stats, healthStatus, recentOrders, totalCustomers, totalUsers, queueInfo, onNavigate }) {
  const [timeRange, setTimeRange] = useState('today');
  
  const calculateGrowth = (current, previous) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous * 100).toFixed(1);
  };

  const avgOrderValue = stats.totalOrders > 0 
    ? (stats.totalRevenue / stats.totalOrders).toFixed(2) 
    : '0.00';

  // Calculate best selling products
  const productSales = {};
  recentOrders.forEach(order => {
    order.items?.forEach(item => {
      if (!productSales[item.productName]) {
        productSales[item.productName] = { quantity: 0, revenue: 0 };
      }
      productSales[item.productName].quantity += item.quantity || 0;
      productSales[item.productName].revenue += item.totalPrice || 0;
    });
  });
  const bestSellers = Object.entries(productSales)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Calculate customer stats
  const uniqueCustomers = new Set(recentOrders.map(o => o.customerInfo?.email).filter(Boolean));
  const repeatCustomers = recentOrders.filter((order, index, self) => 
    index !== self.findIndex(o => o.customerInfo?.email === order.customerInfo?.email)
  ).length;

  return (
    <div className="admin-dashboard-view">
      <div className="admin-header">
        <h2>Admin Dashboard</h2>
        <div className="time-range-selector">
          <button 
            className={timeRange === 'today' ? 'active' : ''}
            onClick={() => setTimeRange('today')}
          >
            Vandaag
          </button>
          <button 
            className={timeRange === 'week' ? 'active' : ''}
            onClick={() => setTimeRange('week')}
          >
            Deze Week
          </button>
          <button 
            className={timeRange === 'month' ? 'active' : ''}
            onClick={() => setTimeRange('month')}
          >
            Deze Maand
          </button>
          <button 
            className={timeRange === 'all' ? 'active' : ''}
            onClick={() => setTimeRange('all')}
          >
            Alles
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card revenue">
          <div className="stat-card-header">
            <div className="stat-icon">💰</div>
            <div className="stat-trend positive">+12.5%</div>
          </div>
          <div className="stat-value">€{stats.totalRevenue.toFixed(2)}</div>
          <div className="stat-label">Totale Omzet</div>
          <div className="stat-subtext">Gemiddeld: €{avgOrderValue} per bestelling</div>
        </div>

        <div className="admin-stat-card orders">
          <div className="stat-card-header">
            <div className="stat-icon">📦</div>
            <div className="stat-trend positive">+8.2%</div>
          </div>
          <div className="stat-value">{stats.totalOrders}</div>
          <div className="stat-label">Totaal Bestellingen</div>
          <div className="stat-subtext">Laatste 24u: {recentOrders.length}</div>
        </div>

        <div className="admin-stat-card customers">
          <div className="stat-card-header">
            <div className="stat-icon">👥</div>
            <div className="stat-trend positive">+5.1%</div>
          </div>
          <div className="stat-value">{totalCustomers}</div>
          <div className="stat-label">Totaal Klanten</div>
          <div className="stat-subtext">Actieve klanten</div>
        </div>

        <div className="admin-stat-card products">
          <div className="stat-card-header">
            <div className="stat-icon">🍬</div>
            <div className="stat-trend neutral">0%</div>
          </div>
          <div className="stat-value">{stats.totalCandies}</div>
          <div className="stat-label">Beschikbare Producten</div>
          <div className="stat-subtext">In catalogus</div>
        </div>

        <div className="admin-stat-card users">
          <div className="stat-card-header">
            <div className="stat-icon">👤</div>
            <div className="stat-trend neutral">-</div>
          </div>
          <div className="stat-value">{totalUsers}</div>
          <div className="stat-label">Gebruikers</div>
          <div className="stat-subtext">Totaal accounts</div>
        </div>

        <div className="admin-stat-card system">
          <div className="stat-card-header">
            <div className="stat-icon">⚙️</div>
            <div className={`stat-trend ${healthStatus?.status === 'ok' ? 'positive' : 'negative'}`}>
              {healthStatus?.status === 'ok' ? 'Online' : 'Offline'}
            </div>
          </div>
          <div className="stat-value">{healthStatus?.status === 'ok' ? '✅' : '❌'}</div>
          <div className="stat-label">System Status</div>
          <div className="stat-subtext">{healthStatus?.service || 'N/A'}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="admin-quick-actions">
        <h3>Snelle Acties</h3>
        <div className="quick-actions-grid">
          <button 
            className="quick-action-btn"
            onClick={() => onNavigate && onNavigate('orders')}
          >
            <span className="action-icon">➕</span>
            <span className="action-text">Nieuwe Bestelling</span>
          </button>
          <button 
            className="quick-action-btn"
            onClick={() => onNavigate && onNavigate('customers')}
          >
            <span className="action-icon">👤</span>
            <span className="action-text">Klant Toevoegen</span>
          </button>
          <button 
            className="quick-action-btn"
            onClick={() => onNavigate && onNavigate('analytics')}
          >
            <span className="action-icon">📊</span>
            <span className="action-text">Rapport Genereren</span>
          </button>
          <button 
            className="quick-action-btn"
            onClick={() => onNavigate && onNavigate('settings')}
          >
            <span className="action-icon">⚙️</span>
            <span className="action-text">Instellingen</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="admin-activity-grid">
        <div className="activity-card recent-orders">
          <div className="card-header">
            <h3>Recente Bestellingen</h3>
            <button 
              className="view-all-btn"
              onClick={() => onNavigate && onNavigate('orders')}
            >
              Alles Bekijken →
            </button>
          </div>
          <div className="orders-list-compact">
            {recentOrders.length > 0 ? (
              recentOrders.slice(0, 5).map(order => (
                <div key={order.id} className="order-item-compact">
                  <div className="order-info">
                    <div className="order-id">{order.id}</div>
                    <div className="order-customer">{order.customerInfo?.name || 'Onbekend'}</div>
                  </div>
                  <div className="order-meta">
                    <div className="order-amount">€{order.totalAmount?.toFixed(2) || '0.00'}</div>
                    <div className="order-date">
                      {new Date(order.timestamp || Date.now()).toLocaleDateString('nl-NL')}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state-small">Geen recente bestellingen</div>
            )}
          </div>
        </div>

        <div className="activity-card system-status">
          <div className="card-header">
            <h3>System Status</h3>
            <span className={`status-indicator ${healthStatus?.status === 'ok' ? 'online' : 'offline'}`}>
              {healthStatus?.status === 'ok' ? '●' : '○'}
            </span>
          </div>
          <div className="status-details">
            <div className="status-item">
              <span className="status-label">API Server:</span>
              <span className={`status-value ${healthStatus?.status === 'ok' ? 'success' : 'error'}`}>
                {healthStatus?.status === 'ok' ? 'Online' : 'Offline'}
              </span>
            </div>
            {queueInfo && (
              <>
                <div className="status-item">
                  <span className="status-label">RabbitMQ:</span>
                  <span className="status-value success">Connected</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Queue Messages:</span>
                  <span className="status-value">{queueInfo.messages || 0}</span>
                </div>
              </>
            )}
            <div className="status-item">
              <span className="status-label">Uptime:</span>
              <span className="status-value">99.9%</span>
            </div>
          </div>
        </div>

        <div className="activity-card best-sellers">
          <div className="card-header">
            <h3>🏆 Best Verkochte Producten</h3>
          </div>
          <div className="best-sellers-list">
            {bestSellers.length > 0 ? (
              bestSellers.map((product, index) => (
                <div key={product.name} className="best-seller-item">
                  <div className="seller-rank">#{index + 1}</div>
                  <div className="seller-info">
                    <div className="seller-name">{product.name}</div>
                    <div className="seller-stats">
                      {product.quantity}x verkocht • €{product.revenue.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state-small">Nog geen verkoop data</div>
            )}
          </div>
        </div>

        <div className="activity-card customer-insights">
          <div className="card-header">
            <h3>👥 Klant Inzichten</h3>
          </div>
          <div className="insights-grid">
            <div className="insight-item">
              <div className="insight-label">Unieke Klanten</div>
              <div className="insight-value">{uniqueCustomers.size}</div>
            </div>
            <div className="insight-item">
              <div className="insight-label">Terugkerende Klanten</div>
              <div className="insight-value">{repeatCustomers}</div>
            </div>
            <div className="insight-item">
              <div className="insight-label">Gemiddeld per Klant</div>
              <div className="insight-value">
                €{uniqueCustomers.size > 0 ? (stats.totalRevenue / uniqueCustomers.size).toFixed(2) : '0.00'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminOrdersView({ orders, customers, onRefresh }) {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const matchesSearch = !searchTerm || 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerInfo?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerInfo?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (sortBy === 'date-desc') return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    if (sortBy === 'date-asc') return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
    if (sortBy === 'amount-desc') return (b.totalAmount || 0) - (a.totalAmount || 0);
    if (sortBy === 'amount-asc') return (a.totalAmount || 0) - (b.totalAmount || 0);
    return 0;
  });

  return (
    <div className="admin-orders-view">
      <div className="admin-view-header">
        <h2>Bestellingen Beheer</h2>
        <div className="header-actions">
          <button className="btn-primary" onClick={onRefresh}>
            🔄 Vernieuwen
          </button>
          <button className="btn-secondary">
            📥 Exporteren
          </button>
        </div>
      </div>

      <div className="admin-filters">
        <div className="filter-group">
          <input
            type="text"
            className="search-input"
            placeholder="Zoek op order ID, klant naam of email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select 
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Alle Status</option>
            <option value="pending">In Afwachting</option>
            <option value="processing">In Verwerking</option>
            <option value="completed">Voltooid</option>
            <option value="cancelled">Geannuleerd</option>
          </select>
        </div>
        <div className="filter-group">
          <select 
            className="filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date-desc">Nieuwste Eerst</option>
            <option value="date-asc">Oudste Eerst</option>
            <option value="amount-desc">Hoogste Bedrag</option>
            <option value="amount-asc">Laagste Bedrag</option>
          </select>
        </div>
      </div>

      <div className="orders-summary">
        <div className="summary-item">
          <span className="summary-label">Totaal:</span>
          <span className="summary-value">{sortedOrders.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Totaal Waarde:</span>
          <span className="summary-value">
            €{sortedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toFixed(2)}
          </span>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Klant</th>
              <th>Items</th>
              <th>Bedrag</th>
              <th>Datum</th>
              <th>Status</th>
              <th>Acties</th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.length > 0 ? (
              sortedOrders.map(order => (
                <tr key={order.id}>
                  <td><code className="order-id-code">{order.id}</code></td>
                  <td>
                    <div className="customer-cell">
                      <strong>{order.customerInfo?.name || 'Onbekend'}</strong>
                      <small>{order.customerInfo?.email || ''}</small>
                    </div>
                  </td>
                  <td>
                    <span className="items-count">{order.items?.length || 0} items</span>
                  </td>
                  <td>
                    <strong className="amount-cell">€{order.totalAmount?.toFixed(2) || '0.00'}</strong>
                  </td>
                  <td>
                    {new Date(order.timestamp || Date.now()).toLocaleString('nl-NL')}
                  </td>
                  <td>
                    <span className="status-badge completed">Voltooid</span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="action-btn view" 
                        title="Bekijken"
                        onClick={() => {
                          alert(`Order Details:\n\nID: ${order.id}\nKlant: ${order.customerInfo?.name || 'Onbekend'}\nEmail: ${order.customerInfo?.email || 'N/A'}\nBedrag: €${order.totalAmount?.toFixed(2) || '0.00'}\nItems: ${order.items?.length || 0}\nDatum: ${new Date(order.timestamp || Date.now()).toLocaleString('nl-NL')}`);
                        }}
                      >
                        👁️
                      </button>
                      <button 
                        className="action-btn edit" 
                        title="Bewerken"
                        onClick={() => {
                          alert('Order bewerken functionaliteit komt binnenkort beschikbaar!');
                        }}
                      >
                        ✏️
                      </button>
                      <button 
                        className="action-btn delete" 
                        title="Verwijderen"
                        onClick={() => {
                          if (window.confirm(`Weet je zeker dat je order ${order.id} wilt verwijderen?`)) {
                            alert('Order verwijderen functionaliteit komt binnenkort beschikbaar!');
                          }
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="empty-table">
                  <div className="empty-state">
                    <p>Geen bestellingen gevonden</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminCustomersView({ customers, onCreateCustomer, onUpdateCustomer, onDeleteCustomer, onRefresh, loading }) {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
  });

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      postalCode: customer.postalCode || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCustomer) {
      onUpdateCustomer(editingCustomer.id, formData);
    } else {
      onCreateCustomer(formData);
    }
    setFormData({ name: '', email: '', phone: '', address: '', city: '', postalCode: '' });
    setShowForm(false);
    setEditingCustomer(null);
  };

  const handleDelete = (customer) => {
    onDeleteCustomer(customer.id);
  };

  return (
    <div className="admin-customers-view">
      <div className="admin-view-header">
        <h2>Klanten Beheer</h2>
        <div className="header-actions">
          <button className="btn-secondary" onClick={onRefresh} disabled={loading}>
            🔄 Vernieuwen
          </button>
          <button 
            className="btn-primary" 
            onClick={() => { 
              setShowForm(!showForm); 
              setEditingCustomer(null);
              setFormData({ name: '', email: '', phone: '', address: '', city: '', postalCode: '' });
            }}
          >
            {showForm ? '✕ Annuleren' : '+ Nieuwe Klant'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="admin-form-card">
          <h3>{editingCustomer ? 'Klant Bewerken' : 'Nieuwe Klant Aanmaken'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
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
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Telefoon</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Postcode</label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Adres</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Stad</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Bezig...' : editingCustomer ? 'Opslaan' : 'Klant Aanmaken'}
            </button>
          </form>
        </div>
      )}

      <div className="admin-filters">
        <input
          type="text"
          className="search-input"
          placeholder="Zoek klanten op naam, email of ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="customers-summary">
        <div className="summary-item">
          <span className="summary-label">Totaal Klanten:</span>
          <span className="summary-value">{filteredCustomers.length}</span>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Naam</th>
              <th>Email</th>
              <th>Telefoon</th>
              <th>Adres</th>
              <th>Acties</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map(customer => (
                <tr key={customer.id}>
                  <td><code className="customer-id-code">{customer.id}</code></td>
                  <td><strong>{customer.name}</strong></td>
                  <td>{customer.email}</td>
                  <td>{customer.phone || '-'}</td>
                  <td>
                    {customer.address ? `${customer.address}, ${customer.postalCode} ${customer.city}` : '-'}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn edit" title="Bewerken">✏️</button>
                      <button className="action-btn delete" title="Verwijderen">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="empty-table">
                  <div className="empty-state">
                    <p>Geen klanten gevonden</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminUsersView({ users, onRefresh, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="admin-users-view">
      <div className="admin-view-header">
        <h2>Gebruikers Beheer</h2>
        <div className="header-actions">
          <button className="btn-secondary" onClick={onRefresh} disabled={loading}>
            🔄 Vernieuwen
          </button>
        </div>
      </div>

      <div className="admin-filters">
        <input
          type="text"
          className="search-input"
          placeholder="Zoek gebruikers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="filter-select"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="all">Alle Rollen</option>
          <option value="admin">Admin</option>
          <option value="user">Gebruiker</option>
        </select>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Naam</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Aangemaakt</th>
              <th>Laatste Update</th>
              <th>Acties</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => (
                <tr key={user.id}>
                  <td><strong>{user.name}</strong></td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge ${user.role === 'admin' ? 'admin' : 'user'}`}>
                      {user.role === 'admin' ? '👑 Admin' : '👤 Gebruiker'}
                    </span>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString('nl-NL')}</td>
                  <td>{new Date(user.updatedAt).toLocaleDateString('nl-NL')}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn edit" title="Bewerken">✏️</button>
                      <button className="action-btn delete" title="Verwijderen">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="empty-table">
                  <div className="empty-state">
                    <p>Geen gebruikers gevonden</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminProductsView({ candies, onRefresh, onCreateCandy, onUpdateCandy, onDeleteCandy, loading, showMessage }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingCandy, setEditingCandy] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    pricePer100g: '',
    image: '',
  });

  const availableCategories = ['Zuur', 'Zacht', 'Drop', 'Chocolade', 'Fruit', 'Munt', 'Hard', 'Speciaal'];
  const categories = ['all', ...Array.from(new Set(candies.map(c => c.category)))];
  const filteredProducts = candies.filter(candy => {
    const matchesSearch = !searchTerm ||
      candy.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candy.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || candy.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleEdit = (candy) => {
    setEditingCandy(candy);
    setFormData({
      name: candy.name || '',
      description: candy.description || '',
      category: candy.category || '',
      pricePer100g: candy.pricePer100g?.toString() || '',
      image: candy.image || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (candy) => {
    onDeleteCandy(candy.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.category || !formData.pricePer100g) {
      showMessage('error', 'Vul alstublieft naam, categorie en prijs in');
      return;
    }

    const price = parseFloat(formData.pricePer100g);
    if (isNaN(price) || price < 0) {
      showMessage('error', 'Prijs moet een geldig positief getal zijn');
      return;
    }

    const candyData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      category: formData.category.trim(),
      pricePer100g: price,
      image: formData.image.trim() || undefined,
    };

    if (editingCandy) {
      await onUpdateCandy(editingCandy.id, candyData);
    } else {
      await onCreateCandy(candyData);
    }

    setFormData({ name: '', description: '', category: '', pricePer100g: '', image: '' });
    setShowForm(false);
    setEditingCandy(null);
  };

  const handleCancel = () => {
    setFormData({ name: '', description: '', category: '', pricePer100g: '', image: '' });
    setShowForm(false);
    setEditingCandy(null);
  };

  return (
    <div className="admin-products-view">
      <div className="admin-view-header">
        <h2>Producten Beheer</h2>
        <div className="header-actions">
          <button className="btn-secondary" onClick={onRefresh} disabled={loading}>
            🔄 Vernieuwen
          </button>
          <button 
            className="btn-primary" 
            onClick={() => {
              setShowForm(!showForm);
              setEditingCandy(null);
              setFormData({ name: '', description: '', category: '', pricePer100g: '', image: '' });
            }}
          >
            {showForm ? '✕ Annuleren' : '+ Nieuw Product'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="admin-form-card">
          <h3>{editingCandy ? 'Product Bewerken' : 'Nieuw Product Aanmaken'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Product Naam *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Bijv. Zure Matten"
                />
              </div>
              <div className="form-group">
                <label>Categorie *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  <option value="">Selecteer categorie</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Prijs per 100g (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.pricePer100g}
                  onChange={(e) => setFormData({ ...formData, pricePer100g: e.target.value })}
                  required
                  placeholder="2.50"
                />
              </div>
              <div className="form-group">
                <label>Afbeelding URL (optioneel)</label>
                <input
                  type="url"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Beschrijving</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                placeholder="Beschrijf het product..."
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Bezig...' : editingCandy ? '💾 Product Opslaan' : '➕ Product Aanmaken'}
              </button>
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-filters">
        <input
          type="text"
          className="search-input"
          placeholder="Zoek producten..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="filter-select"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat === 'all' ? 'Alle Categorieën' : cat}</option>
          ))}
        </select>
      </div>

      <div className="products-summary">
        <div className="summary-item">
          <span className="summary-label">Totaal Producten:</span>
          <span className="summary-value">{filteredProducts.length}</span>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Categorie</th>
              <th>Prijs (per 100g)</th>
              <th>Beschrijving</th>
              <th>Acties</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length > 0 ? (
              filteredProducts.map(candy => (
                <tr key={candy.id}>
                  <td>
                    <div className="product-cell">
                      <strong>{candy.name}</strong>
                      <code className="product-id-code">{candy.id}</code>
                    </div>
                  </td>
                  <td>
                    <span className="category-badge">{candy.category}</span>
                  </td>
                  <td>
                    <strong>€{candy.pricePer100g.toFixed(2)}</strong>
                  </td>
                  <td className="description-cell">{candy.description}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn edit" title="Bewerken">✏️</button>
                      <button className="action-btn delete" title="Verwijderen">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="empty-table">
                  <div className="empty-state">
                    <p>Geen producten gevonden</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminQueueView({ queueInfo, onRefresh }) {
  return (
    <div className="admin-queue-view">
      <div className="admin-view-header">
        <h2>Queue Monitor</h2>
        <button className="btn-secondary" onClick={onRefresh}>
          🔄 Vernieuwen
        </button>
      </div>

      {queueInfo ? (
        <div className="queue-info-grid">
          <div className="queue-stat-card">
            <div className="queue-stat-label">Messages in Queue</div>
            <div className="queue-stat-value">{queueInfo.messages || 0}</div>
          </div>
          <div className="queue-stat-card">
            <div className="queue-stat-label">Consumers</div>
            <div className="queue-stat-value">{queueInfo.consumers || 0}</div>
          </div>
          <div className="queue-stat-card">
            <div className="queue-stat-label">Queue Name</div>
            <div className="queue-stat-value">{queueInfo.queue || 'N/A'}</div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p>Geen queue informatie beschikbaar</p>
        </div>
      )}
    </div>
  );
}

function AdminAnalyticsView({ stats, orders, customers }) {
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  const calculateMetrics = () => {
    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
    const ordersToday = orders.filter(o => {
      const orderDate = new Date(o.timestamp || Date.now());
      const today = new Date();
      return orderDate.toDateString() === today.toDateString();
    }).length;

    return {
      totalRevenue,
      avgOrderValue,
      ordersToday,
      totalOrders: orders.length,
      totalCustomers: customers.length,
    };
  };

  const metrics = calculateMetrics();

  return (
    <div className="admin-analytics-view">
      <div className="admin-view-header">
        <h2>Analytics & Rapporten</h2>
        <div className="period-selector">
          <button 
            className={selectedPeriod === 'day' ? 'active' : ''}
            onClick={() => setSelectedPeriod('day')}
          >
            Vandaag
          </button>
          <button 
            className={selectedPeriod === 'week' ? 'active' : ''}
            onClick={() => setSelectedPeriod('week')}
          >
            Week
          </button>
          <button 
            className={selectedPeriod === 'month' ? 'active' : ''}
            onClick={() => setSelectedPeriod('month')}
          >
            Maand
          </button>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card">
          <h3>Omzet Overzicht</h3>
          <div className="analytics-value">€{metrics.totalRevenue.toFixed(2)}</div>
          <div className="analytics-chart-placeholder">
            <p>📊 Omzet grafiek komt hier</p>
          </div>
        </div>

        <div className="analytics-card">
          <h3>Bestellingen Trend</h3>
          <div className="analytics-value">{metrics.totalOrders}</div>
          <div className="analytics-chart-placeholder">
            <p>📈 Bestellingen trend komt hier</p>
          </div>
        </div>

        <div className="analytics-card">
          <h3>Klant Statistieken</h3>
          <div className="analytics-metrics">
            <div className="metric-item">
              <span className="metric-label">Totaal Klanten:</span>
              <span className="metric-value">{metrics.totalCustomers}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Gemiddeld Order:</span>
              <span className="metric-value">€{metrics.avgOrderValue.toFixed(2)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Orders Vandaag:</span>
              <span className="metric-value">{metrics.ordersToday}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminSettingsView({ healthStatus }) {
  return (
    <div className="admin-settings-view">
      <div className="admin-view-header">
        <h2>Instellingen</h2>
      </div>

      <div className="settings-sections">
        <div className="settings-section">
          <h3>System Instellingen</h3>
          <div className="settings-item">
            <label>API Endpoint</label>
            <input type="text" defaultValue="http://localhost:3000" />
          </div>
          <div className="settings-item">
            <label>RabbitMQ URL</label>
            <input type="text" defaultValue="amqp://localhost:5672" />
          </div>
        </div>

        <div className="settings-section">
          <h3>Notificaties</h3>
          <div className="settings-item">
            <label>
              <input type="checkbox" defaultChecked />
              Email notificaties inschakelen
            </label>
          </div>
          <div className="settings-item">
            <label>
              <input type="checkbox" defaultChecked />
              System alerts inschakelen
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h3>System Status</h3>
          <div className="status-grid">
            <div className="status-item">
              <span>API Status:</span>
              <span className={healthStatus?.status === 'ok' ? 'status-online' : 'status-offline'}>
                {healthStatus?.status === 'ok' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
