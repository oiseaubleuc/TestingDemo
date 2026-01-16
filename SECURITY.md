# Security Implementation Guide

## Overview
This document outlines all security improvements implemented to protect the RabbitMQ-Salesforce integration API.

---

## 1. Helmet.js - Security Headers

**What it does:** Adds 15+ security-related HTTP headers automatically.

**Headers added:**
- `X-Frame-Options: DENY` - Prevents clickjacking attacks
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - Enables browser XSS protection
- `Strict-Transport-Security` - Forces HTTPS for 1 year
- `Content-Security-Policy` - Controls resource loading
- `Referrer-Policy` - Controls referrer information
- `Permissions-Policy` - Restricts browser APIs

**Implementation:** Applied as first middleware in Express

---

## 2. CORS Whitelisting

**What it does:** Only allows requests from specified origins instead of all origins.

**Configuration:**
```typescript
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

**How it works:**
- Requests from `localhost:5173` (frontend) → ✅ Allowed
- Requests from `example.com` → ❌ Blocked
- Requests with no origin (mobile apps, curl) → ✅ Allowed

**Update your `.env`:**
```
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

## 3. Rate Limiting

**What it does:** Limits number of requests per IP per time window.

**Three tiers implemented:**

### Global Rate Limiter
- **Limit:** 100 requests per 15 minutes
- **Applies to:** All endpoints (except health checks)
- **Response:** 429 Too Many Requests

### Authentication Rate Limiter
- **Limit:** 5 requests per 15 minutes
- **Applies to:** `/api/messages`, `/api/customers`
- **Purpose:** Prevent brute force attacks

### Order Creation Rate Limiter
- **Limit:** 10 requests per 1 minute
- **Applies to:** `/api/orders`, `/api/orders/candy`
- **Purpose:** Prevent order flooding

**To disable in development:**
```
ENABLE_RATE_LIMITING=false
```

---

## 4. API Key Authentication

**What it does:** Requires `X-API-Key` header for protected endpoints.

**Public endpoints (no API key required):**
- `GET /` - Info endpoint
- `GET /health` - Health check
- `GET /api/candies` - Candy list

**Protected endpoints (API key required):**
- `POST /api/messages`
- `POST /api/customers`
- `POST /api/orders`
- `POST /api/orders/candy`
- `GET /queue/info`

**How to use:**
```bash
# Include in request header
curl -X POST http://localhost:3000/api/messages \
  -H "X-API-Key: your-secure-api-key" \
  -H "Content-Type: application/json" \
  -d '{"event": "CREATE_ORDER", "payload": {...}}'
```

**Generate a strong API key:**
```bash
# macOS/Linux
openssl rand -hex 32

# Or use this command
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Set in `.env`:**
```
API_KEY=your-generated-key-here
```

**For production:** Use strong, random keys and rotate regularly.

---

## 5. Input Validation

**What it does:** Validates all incoming data before processing.

**Validators implemented:**

### Email Validation
- Format: `^[^\s@]+@[^\s@]+\.[^\s@]+$`
- Max length: 255 characters
- Applied to: customer email fields

### Customer Info Validation
- Name: non-empty string, max 255 chars
- Email: must be valid format
- Phone: optional, max 20 chars
- Applied to: `POST /api/customers`, `POST /api/orders/candy`

### Basket Validation
- Must be non-empty array
- Each item must have valid `productId`
- Quantity: number between 1-1000
- Applied to: `POST /api/orders/candy`

### Payload Size Validation
- Max payload: 100KB
- Applied to: All POST requests (via `express.json({ limit: '10kb' })`)

---

## 6. Error Sanitization

**What it does:** Hides sensitive information from error responses.

**Development mode** (NODE_ENV=development):
```json
{
  "error": "Detailed error message with full stack trace"
}
```

**Production mode** (NODE_ENV=production):
```json
{
  "error": "An error occurred processing your request"
}
```

**Set in `.env`:**
```
NODE_ENV=production
```

---

## 7. Sensitive Data Masking in Logs

**What it does:** Automatically masks sensitive fields in logs.

**Masked fields:**
- `password`
- `token`
- `access_token`
- `refresh_token`
- `secret`
- `clientSecret`
- `apiKey`
- `creditCard`
- `ssn`

**Example:**
```javascript
// Before logging
logger.error('API Error', {
  error: error.message,
  user: { 
    email: 'user@example.com', 
    password: 'mypassword123' 
  }
});

// In logs
logger.error('API Error', {
  error: error.message,
  user: { 
    email: 'user@example.com', 
    password: '***REDACTED***' 
  }
});
```

---

## 8. Payload Size Limiting

**What it does:** Limits request body size to prevent memory exhaustion.

**Configuration:**
```typescript
app.use(express.json({ limit: '10kb' }));
```

**Limits:**
- JSON payload: 10KB per request
- Total payload in validator: 100KB max

---

## 9. Input Sanitization

**What it does:** Removes potentially dangerous characters from input.

**Sanitization rules:**
- Removes `<` and `>` characters (prevents XSS)
- Trims whitespace
- Applied to: request body and query parameters

---

## 10. Security Headers

**Custom headers added:**
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

---

## Usage Examples

### With API Key
```bash
# Get queue info
curl http://localhost:3000/queue/info \
  -H "X-API-Key: your-api-key"

# Create order
curl -X POST http://localhost:3000/api/orders/candy \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "basket": [{"candyId": "candy1", "quantity": 2}],
    "customerInfo": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    }
  }'
```

### Rate Limit Response
```bash
# 6th request within 15 minutes
HTTP/1.1 429 Too Many Requests
{
  "error": "Too many requests from this IP, please try again later."
}
```

### Validation Error
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John",
    "email": "invalid-email"
  }'

HTTP/1.1 400 Bad Request
{
  "error": "Invalid email format"
}
```

---

## Production Checklist

Before deploying to production, ensure:

- [ ] **API Key:** Generate strong random key and set `API_KEY=<strong-key>`
- [ ] **ALLOWED_ORIGINS:** Update to your actual domain(s)
- [ ] **NODE_ENV:** Set to `production`
- [ ] **HTTPS:** Enable HTTPS on your server (add reverse proxy like Nginx)
- [ ] **CORS:** Review and restrict origins to only necessary domains
- [ ] **Rate Limits:** Adjust limits based on your traffic patterns
- [ ] **Salesforce Credentials:** Use secure refresh tokens, not username/password
- [ ] **Environment Variables:** Never commit `.env` file to git
- [ ] **Logging:** Ensure logs don't expose sensitive data (already handled)
- [ ] **Firewall:** Restrict API access by IP if possible
- [ ] **Dependencies:** Run `npm audit fix` and fix vulnerabilities
- [ ] **Headers:** Verify security headers are present (check with curl -i)
- [ ] **Monitoring:** Set up alerts for rate limit breaches and errors

---

## Common Issues

### API key rejected
```
Error: Unauthorized - Invalid or missing API key

Fix: 
1. Include header: -H "X-API-Key: your-key"
2. Verify key matches API_KEY in .env
3. Restart the server after changing .env
```

### CORS blocked
```
Error: CORS policy violation from origin 'http://example.com'

Fix:
1. Add domain to ALLOWED_ORIGINS in .env
2. Format: http://example.com (no trailing slash)
3. Separate multiple with comma
4. Restart server
```

### Rate limit exceeded
```
Error: Too many requests from this IP, please try again later.

Fix:
1. Wait 15 minutes for rate limit to reset
2. Or adjust ENABLE_RATE_LIMITING=false in dev
3. Adjust limits in src/middleware/security.ts for production
```

### Payload too large
```
Error: Payload too large (max 100KB)

Fix: Reduce data being sent in single request
```

---

## Security Headers Verification

Check if security headers are properly set:

```bash
curl -i http://localhost:3000/api/candies | grep -E "^X-|^Strict-Transport|^Content-Security"
```

Expected output should include security headers.

---

## References

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Express Rate Limiter](https://github.com/nfriedly/express-rate-limit)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
