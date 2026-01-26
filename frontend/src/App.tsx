import { useEffect, useMemo, useState } from 'react';
import { apiClient } from './api/client';
import type { Product } from './api/client';
import './App.css';

type BasketItem = {
  productKey: string; // externalProductId
  product: Product;
  quantity: number; // aantal keer 100g
};

const CART_STORAGE_KEY = 'snoepwinkel_basket_v1';
const AUTH_TOKEN_KEY = 'snoepwinkel_token_v1';
const AUTH_EMAIL_KEY = 'snoepwinkel_email_v1';
const CUSTOMER_INFO_KEY = 'snoepwinkel_customerinfo_v1';

function loadBasketFromSession(): BasketItem[] {
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BasketItem[];

    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x: any) =>
        x &&
        typeof x.productKey === 'string' &&
        typeof x.quantity === 'number' &&
        x.product &&
        typeof x.product.externalProductId === 'string'
    );
  } catch {
    return [];
  }
}

function saveBasketToSession(basket: BasketItem[]) {
  try {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(basket));
  } catch {
    // ignore
  }
}

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase();
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function getStoredEmail(): string | null {
  try {
    return localStorage.getItem(AUTH_EMAIL_KEY);
  } catch {
    return null;
  }
}

function saveAuth(token: string, email: string) {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_EMAIL_KEY, email);
  } catch {
    // ignore
  }
}

function clearAuth() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EMAIL_KEY);
  } catch {
    // ignore
  }
}

function loadSavedCustomerInfo(): {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
} | null {
  try {
    const raw = localStorage.getItem(CUSTOMER_INFO_KEY);
    if (!raw) return null;
    const x = JSON.parse(raw);
    if (!x || typeof x !== 'object') return null;
    return {
      name: String(x.name ?? ''),
      email: String(x.email ?? ''),
      phone: String(x.phone ?? ''),
      address: String(x.address ?? ''),
      city: String(x.city ?? ''),
      postalCode: String(x.postalCode ?? ''),
    };
  } catch {
    return null;
  }
}

function saveCustomerInfo(info: {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
}) {
  try {
    localStorage.setItem(CUSTOMER_INFO_KEY, JSON.stringify(info));
  } catch {
    // ignore
  }
}

function App() {
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [basket, setBasket] = useState<BasketItem[]>(() => loadBasketFromSession());

  // ✅ 2-step checkout: eerst email popup, daarna checkout form popup
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [authEmail, setAuthEmail] = useState<string>(() => getStoredEmail() || '');

  const [customerInfo, setCustomerInfo] = useState(() => {
    const saved = loadSavedCustomerInfo();
    return (
      saved || {
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        postalCode: '',
      }
    );
  });

  const [loginEmail, setLoginEmail] = useState<string>(() => {
    const e = getStoredEmail();
    return e || customerInfo.email || '';
  });

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    saveBasketToSession(basket);
  }, [basket]);

  useEffect(() => {
    if (products.length === 0) return;

    setBasket((prev) =>
      prev
        .map((item) => {
          const fresh = products.find((p) => p.externalProductId === item.productKey);
          return fresh ? { ...item, product: fresh } : null;
        })
        .filter(Boolean) as BasketItem[]
    );
  }, [products]);

  useEffect(() => {
    saveCustomerInfo(customerInfo);
  }, [customerInfo]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const response = await apiClient.getProducts();
      setProducts(response.products);
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  };

  const addToBasket = (product: Product) => {
    if (product.stock <= 0) {
      showMessage('error', `${product.name} is uitverkocht`);
      return;
    }

    const existing = basket.find((item) => item.productKey === product.externalProductId);
    const currentQty = existing?.quantity ?? 0;

    if (currentQty + 1 > product.stock) {
      showMessage('error', `Niet genoeg stock voor ${product.name} (beschikbaar: ${product.stock})`);
      return;
    }

    if (existing) {
      setBasket(
        basket.map((item) =>
          item.productKey === product.externalProductId ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setBasket([...basket, { productKey: product.externalProductId, product, quantity: 1 }]);
    }

    showMessage('success', `${product.name} toegevoegd aan mandje!`);
  };

  const updateBasketQuantity = (productKey: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromBasket(productKey);
      return;
    }

    const prod = products.find((p) => p.externalProductId === productKey);
    if (prod && quantity > prod.stock) {
      showMessage('error', `Niet genoeg stock (beschikbaar: ${prod.stock})`);
      return;
    }

    setBasket(basket.map((item) => (item.productKey === productKey ? { ...item, quantity } : item)));
  };

  const removeFromBasket = (productKey: string) => {
    setBasket(basket.filter((item) => item.productKey !== productKey));
  };

  const clearBasket = () => {
    setBasket([]);
    try {
      sessionStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const getTotalPrice = () => basket.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const getTotalWeight = () => basket.reduce((total, item) => total + item.quantity, 0) * 100;

  const handleLogin = async () => {
    const email = normalizeEmail(loginEmail);
    if (!email || !email.includes('@')) {
      showMessage('error', 'Geef een geldig e-mailadres.');
      return false;
    }

    setLoading(true);
    try {
      const loginRes = await apiClient.loginWithEmail(email);
      saveAuth(loginRes.token, email);
      setToken(loginRes.token);
      setAuthEmail(email);

      const lookup = await apiClient.getCustomerByEmail(email);

      if (lookup.exists && lookup.customer) {
        setCustomerInfo({
          name: lookup.customer.name ?? '',
          email: lookup.customer.email ?? email,
          phone: lookup.customer.phone ?? '',
          address: lookup.customer.address ?? '',
          city: lookup.customer.city ?? '',
          postalCode: lookup.customer.postalCode ?? '',
        });
        showMessage('success', 'Welkom terug! Gegevens zijn ingevuld.');
      } else {
        setCustomerInfo({
          name: '',
          email,
          phone: '',
          address: '',
          city: '',
          postalCode: '',
        });
        showMessage('success', 'Nieuwe klant. Vul je gegevens éénmalig in.');
      }

      return true;
    } catch (e: any) {
      showMessage('error', e?.message || 'Doorgaan mislukt');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    apiClient.logout();
    clearAuth();
    setToken(null);
    setAuthEmail('');
    showMessage('success', 'Uitgelogd.');
  };

  // ✅ Email-step: na "Doorgaan" open je checkout
  const proceedFromEmail = async () => {
    const ok = await handleLogin();
    if (ok) {
      setShowEmailPrompt(false);
      setShowCheckout(true);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (basket.length === 0) {
      showMessage('error', 'Je mandje is leeg!');
      return;
    }

    if (!customerInfo.email) {
      showMessage('error', 'Vul eerst je email in en klik op Doorgaan.');
      return;
    }

    if (!customerInfo.name) {
      showMessage('error', 'Vul je naam in.');
      return;
    }

    setLoading(true);
    try {
      const orderRequest = {
        basket: basket.map((item) => ({
          candyId: item.productKey,
          quantity: item.quantity,
        })),
        customerInfo,
      };

      const response = await apiClient.createCandyOrder(orderRequest);
      showMessage('success', `Bestelling geplaatst! Order ID: ${response.data.orderId}`);

      clearBasket();
      setShowCheckout(false);

      await loadProducts();
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map((p) => (p.category || 'Overig').trim() || 'Overig')));
    unique.sort((a, b) => a.localeCompare(b));
    return ['all', ...unique];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') return products;
    return products.filter((p) => (p.category || 'Overig') === selectedCategory);
  }, [products, selectedCategory]);

  const stockMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.externalProductId, p.stock);
    return m;
  }, [products]);

  return (
    <div className="app">
      <header className="header">
        <h1>🍬 Snoepjes Winkel 🍬</h1>
        <p style={{ marginTop: '0.5rem', color: '#999', fontSize: '0.9rem' }}>
          Producten komen live uit Salesforce — bestellen per 100 gram
        </p>
      </header>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      <div className="shop-container">
        <aside className="basket-sidebar">
          <div className="basket-header">
            <h2>🛒 Winkelmandje</h2>
            {basket.length > 0 && (
              <button className="clear-basket-btn" onClick={clearBasket}>
                Leeg maken
              </button>
            )}
          </div>

          {basket.length === 0 ? (
            <div className="basket-empty">
              <p>Je mandje is leeg</p>
              <p className="basket-empty-hint">Voeg producten toe om te beginnen!</p>
            </div>
          ) : (
            <>
              <div className="basket-items">
                {basket.map((item) => {
                  const liveStock = stockMap.get(item.productKey);
                  return (
                    <div key={item.productKey} className="basket-item">
                      <div className="basket-item-info">
                        <strong>{item.product.name}</strong>
                        <span className="basket-item-price">€{item.product.price.toFixed(2)} per 100g</span>
                        <span className="basket-item-price" style={{ opacity: 0.8 }}>
                          Categorie: {item.product.category || 'Overig'}
                        </span>
                        {typeof liveStock === 'number' && (
                          <span className="basket-item-price" style={{ opacity: 0.8 }}>
                            Stock: {liveStock}
                          </span>
                        )}
                      </div>
                      <div className="basket-item-controls">
                        <button
                          className="quantity-btn"
                          onClick={() => updateBasketQuantity(item.productKey, item.quantity - 1)}
                        >
                          -
                        </button>
                        <span className="quantity-display">{item.quantity}x 100g</span>
                        <button
                          className="quantity-btn"
                          onClick={() => updateBasketQuantity(item.productKey, item.quantity + 1)}
                        >
                          +
                        </button>
                        <button className="remove-btn" onClick={() => removeFromBasket(item.productKey)}>
                          ✕
                        </button>
                      </div>
                      <div className="basket-item-total">€{(item.product.price * item.quantity).toFixed(2)}</div>
                    </div>
                  );
                })}
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

                {/* ✅ Afrekenen -> eerst email popup */}
                <button
                  className="checkout-btn"
                  onClick={() => {
                    setShowCheckout(false);
                    setShowEmailPrompt(true);
                  }}
                >
                  Afrekenen
                </button>
              </div>
            </>
          )}
        </aside>

        <main className="candies-main">
          <div className="category-filter">
            {categories.map((category) => (
              <button
                key={category}
                className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'all' ? 'Alle Producten' : category}
              </button>
            ))}
          </div>

          {loadingProducts ? (
            <div className="loading">Producten laden...</div>
          ) : (
            <div className="candies-grid">
              {filteredProducts.map((p) => {
                const outOfStock = p.stock <= 0;
                return (
                  <div key={p.externalProductId} className="candy-card">
                    <div className="candy-header">
                      <h3>{p.name}</h3>
                      <span className="candy-category">{p.category || 'Overig'}</span>
                    </div>

                    <p className="candy-description" style={{ marginBottom: '0.8rem' }}>
                      External ID: <strong>{p.externalProductId}</strong>
                      <br />
                      Stock: <strong>{p.stock}</strong>
                    </p>

                    <div className="candy-footer">
                      <div className="candy-price">€{p.price.toFixed(2)} / 100g</div>
                      <button
                        className="add-to-basket-btn"
                        onClick={() => addToBasket(p)}
                        disabled={outOfStock}
                        title={outOfStock ? 'Uitverkocht' : 'Toevoegen'}
                      >
                        {outOfStock ? 'Uitverkocht' : '🛒 Toevoegen'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ✅ POPUP 1: alleen email + doorgaan */}
      {showEmailPrompt && (
        <div className="checkout-modal">
          <div className="checkout-content">
            <h2>Verdergaan met e-mail</h2>

            <div className="form-group">
              <label>E-mail</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="jij@example.com"
                required
              />
            </div>

            <div style={{ fontSize: 12, color: '#777', marginTop: 8, marginBottom: 14 }}>
              {token ? (
                <>
                  Ingelogd als <strong>{authEmail}</strong>
                </>
              ) : (
                'We vullen je gegevens automatisch in als we je kennen. Anders vul je ze éénmalig in.'
              )}
            </div>

            <div className="checkout-actions">
              <button type="button" className="cancel-btn" onClick={() => setShowEmailPrompt(false)} disabled={loading}>
                Annuleren
              </button>

              {token && (
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={handleLogout}
                  disabled={loading}
                  style={{ opacity: 0.95 }}
                >
                  Uitloggen
                </button>
              )}

              <button type="button" className="submit-order-btn" onClick={proceedFromEmail} disabled={loading}>
                {loading ? '...' : 'Doorgaan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ POPUP 2: checkout formulier (zonder login-block) */}
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
                  onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                  required
                  placeholder="Jan Jansen"
                />
              </div>

              <div style={{ marginTop: -6, marginBottom: 10, fontSize: 13, color: '#555' }}>
                <strong>Email:</strong> {customerInfo.email || loginEmail || '-'}
              </div>

              <div className="form-group">
                <label>Telefoon</label>
                <input
                  type="tel"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                  placeholder="+31 6 12345678"
                />
              </div>

              <div className="form-group">
                <label>Adres</label>
                <input
                  type="text"
                  value={customerInfo.address}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                  placeholder="Straatnaam 123"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Postcode</label>
                  <input
                    type="text"
                    value={customerInfo.postalCode}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, postalCode: e.target.value })}
                    placeholder="1234AB"
                  />
                </div>
                <div className="form-group">
                  <label>Stad</label>
                  <input
                    type="text"
                    value={customerInfo.city}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, city: e.target.value })}
                    placeholder="Amsterdam"
                  />
                </div>
              </div>

              <div className="checkout-total">
                <strong>Totaal: €{getTotalPrice().toFixed(2)}</strong>
              </div>

              <div className="checkout-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowCheckout(false)} disabled={loading}>
                  Annuleren
                </button>
                <button type="submit" className="submit-order-btn" disabled={loading}>
                  {loading ? 'Bestellen...' : 'Bestelling plaatsen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
