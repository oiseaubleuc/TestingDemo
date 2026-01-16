# Security Quick Reference

## 🚀 Quick Start (5 Minutes)

### 1. Generate API Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Update .env
```bash
cp env.example .env
```

Edit `.env`:
```env
API_KEY=your-generated-64-char-key
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
NODE_ENV=development
```

### 3. Install & Run
```bash
npm install
npm run build
npm run start:api
```

### 4. Test with API Key
```bash
curl http://localhost:3000/queue/info \
  -H "X-API-Key: your-64-char-key"
```

---

## 🔑 API Key Usage

### All Protected Endpoints Require:
```bash
-H "X-API-Key: <your-key>"
```

### Example with All Endpoints:
```bash
# ✅ Works - public endpoint
curl http://localhost:3000/api/candies

# ❌ Fails - missing API key
curl http://localhost:3000/queue/info

# ✅ Works - has API key
curl http://localhost:3000/queue/info \
  -H "X-API-Key: your-key"
```

---

## 📋 Endpoint Status

| Endpoint | Requires API Key |
|----------|-----------------|
| `GET /` | No |
| `GET /health` | No |
| `GET /api/candies` | No |
| `GET /queue/info` | **Yes** |
| `POST /api/messages` | **Yes** |
| `POST /api/customers` | **Yes** |
| `POST /api/orders` | **Yes** |
| `POST /api/orders/candy` | **Yes** |

---

## ⚙️ Environment Variables

### Required for Production
```env
API_KEY=your-strong-random-key
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
NODE_ENV=production
RABBITMQ_URL=amqp://user:pass@host:5672/
SALESFORCE_INSTANCE_URL=https://login.salesforce.com
SALESFORCE_CLIENT_ID=your-client-id
SALESFORCE_CLIENT_SECRET=your-client-secret
SALESFORCE_REFRESH_TOKEN=your-refresh-token
```

### Optional
```env
ENABLE_RATE_LIMITING=true
LOG_LEVEL=info
API_PORT=3000
```

---

## 🛡️ What's Protected

| Type | Protection | Example |
|------|-----------|---------|
| **Headers** | Helmet.js | 15+ security headers |
| **Origins** | CORS whitelist | Only allowed domains |
| **Access** | API key validation | `X-API-Key` header |
| **Input** | Validation | Email, size, type checks |
| **Limits** | Rate limiting | 100 req/15min per IP |
| **Errors** | Sanitization | No stack traces to client |
| **Data** | Masking in logs | Passwords hidden |
| **Payload** | Size limit | 10KB max |

---

## 🧪 Test Scenarios

### Scenario 1: Missing API Key
```bash
curl http://localhost:3000/queue/info
# Response: {"error":"Unauthorized - Invalid or missing API key"}
```

### Scenario 2: Wrong API Key
```bash
curl http://localhost:3000/queue/info \
  -H "X-API-Key: wrong-key"
# Response: {"error":"Unauthorized - Invalid or missing API key"}
```

### Scenario 3: Valid API Key
```bash
curl http://localhost:3000/queue/info \
  -H "X-API-Key: your-actual-key"
# Response: {"...queue info..."}
```

### Scenario 4: Rate Limit Exceeded
```bash
# Make 6+ requests in 15 minutes to /api/messages
curl -X POST http://localhost:3000/api/messages ... (6x)
# Response: {"error":"Too many requests from this IP, please try again later."}
```

### Scenario 5: Invalid Input
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"invalid-email"}'
# Response: {"error":"Invalid email format"}
```

---

## 🚨 Production Deployment Checklist

Before pushing to production:

```
Security:
  ☐ API_KEY set to strong random value (32+ chars)
  ☐ ALLOWED_ORIGINS set to actual domains (not localhost)
  ☐ NODE_ENV=production
  ☐ HTTPS enabled (reverse proxy like Nginx)
  
Salesforce:
  ☐ Using refresh token (not username/password)
  ☐ Credentials in secure vault/env vars
  ☐ Client ID/Secret not hardcoded
  
Monitoring:
  ☐ Error logging configured
  ☐ Alerts set for rate limit breaches
  ☐ Access logs enabled
  
Code:
  ☐ npm audit clean (no high vulnerabilities)
  ☐ TypeScript compiled without errors
  ☐ Tests passing
  
Infrastructure:
  ☐ Firewall rules configured
  ☐ SSL/TLS certificate valid
  ☐ API key rotation plan
  ☐ Backup credentials stored securely
```

---

## 🆘 Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| API key rejected | Missing/wrong key | Include correct `-H "X-API-Key: ..."` |
| CORS error | Origin not allowed | Add domain to `ALLOWED_ORIGINS` |
| Rate limited | Too many requests | Wait 15 mins or disable in dev |
| Invalid email | Bad format | Use format: `user@domain.com` |
| Payload too large | Data exceeds 10KB | Reduce request payload |
| 500 error (prod) | Unhandled error | Check logs with `maskSensitiveData` |

---

## 📚 Full Documentation

- **Detailed guide:** See `SECURITY.md`
- **Implementation details:** See `SECURITY_CHANGES.md`
- **Code:** See `src/middleware/security.ts` and `src/middleware/validation.ts`

---

## 🎯 Key Takeaways

1. **All protected endpoints require `X-API-Key` header**
2. **API key must be strong and random**
3. **CORS is whitelist-based (specify your domains)**
4. **Errors don't expose sensitive information in production**
5. **Rate limits prevent abuse**
6. **Input validation prevents invalid data**
7. **Security headers prevent common attacks**
8. **Sensitive data is masked in logs**

---

## 💡 Pro Tips

- Generate API key once, store securely, rotate periodically
- Test CORS settings with different origins
- Monitor rate limit headers: `RateLimit-*`
- Check security headers: `curl -i http://localhost:3000/api/candies`
- Use API key in frontend `.env`: `VITE_API_KEY=...`
- Never commit `.env` or API keys to git
- Rotate API keys quarterly
- Keep npm dependencies updated

