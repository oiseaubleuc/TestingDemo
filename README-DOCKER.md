# Docker Setup - All-in-One

## 🎯 Overzicht

Dit project gebruikt **één Dockerfile** die alles bevat:
- ✅ Backend API (Node.js/Express)
- ✅ Frontend (React met Nginx)
- ✅ Consumer Worker (RabbitMQ consumer)
- ✅ Alles draait in één container met Supervisor

## 🚀 Quick Start

```bash
# 1. Kopieer environment file
cp docker-compose.env.example .env

# 2. Vul .env in
nano .env

# 3. Start alles
docker-compose up -d

# 4. Wacht tot services starten (15-30 seconden)
sleep 20

# 5. Test alles
./docker/test.sh

# 6. Of test handmatig
curl http://localhost:3000/health  # API direct
curl http://localhost:5173         # Frontend
curl http://localhost:5173/api/candies  # API via proxy

# 7. Bekijk logs
docker-compose logs -f app
```

## 📦 Services in Container

De container draait 3 processen via Supervisor:

1. **API Server** - `node dist/api/server.js` (port 3000)
2. **Consumer Worker** - `node dist/consumer/index.js`
3. **Nginx** - Serves frontend + proxies API (port 80)

## 🔧 Docker Compose

```yaml
services:
  rabbitmq:  # RabbitMQ message queue
  app:       # All-in-one application container
```

## 🌐 Ports

- **Port 3000**: Backend API (direct access)
- **Port 80** (5173 op host): Frontend + API proxy via Nginx
- **Port 5672**: RabbitMQ AMQP
- **Port 15672**: RabbitMQ Management UI

## 📝 Commands

```bash
# Build image
docker build -t rabbitmq-salesforce-app .

# Run container
docker run -d \
  --name app \
  -p 3000:3000 \
  -p 5173:80 \
  --env-file .env \
  rabbitmq-salesforce-app

# Check logs
docker logs -f app-all-in-one

# Check processes
docker exec app-all-in-one ps aux

# Check supervisor status
docker exec app-all-in-one supervisorctl status

# Run test script
chmod +x docker/test.sh
./docker/test.sh
```

## 🧪 Testing

### Test Commands

```bash
# 1. Check if container is running
docker ps | grep app-all-in-one

# 2. Check supervisor processes
docker exec app-all-in-one supervisorctl status

# 3. Test API direct (port 3000)
curl http://localhost:3000/health

# 4. Test Frontend (port 5173)
curl http://localhost:5173

# 5. Test API via Nginx proxy
curl http://localhost:5173/api/candies
curl http://localhost:5173/health

# 6. Use test script
./docker/test.sh
```

### Expected Output

**Supervisor status:**
```
api                              RUNNING   pid 10, uptime 0:00:05
consumer                         RUNNING   pid 11, uptime 0:00:05
nginx                            RUNNING   pid 12, uptime 0:00:05
```

**Health check:**
```json
{"status":"ok","service":"producer-api"}
```

## 🔍 Troubleshooting

### Probleem: Tests werken niet

**1. Check of container draait:**
```bash
docker ps | grep app-all-in-one
```

**2. Check supervisor status:**
```bash
docker exec app-all-in-one supervisorctl status
```

**3. Check logs:**
```bash
# Alle logs
docker logs app-all-in-one

# API logs
docker exec app-all-in-one cat /var/log/supervisor/api.out.log
docker exec app-all-in-one cat /var/log/supervisor/api.err.log

# Nginx logs
docker exec app-all-in-one cat /var/log/supervisor/nginx.err.log

# Consumer logs
docker exec app-all-in-one cat /var/log/supervisor/consumer.err.log
```

**4. Test binnen container:**
```bash
# Test API binnen container
docker exec app-all-in-one curl http://localhost:3000/health

# Test Nginx binnen container
docker exec app-all-in-one curl http://localhost/
```

**5. Rebuild als nodig:**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Probleem: API start niet

**Check environment variabelen:**
```bash
docker exec app-all-in-one env | grep -E "RABBITMQ|SALESFORCE|API_PORT"
```

**Check of RabbitMQ bereikbaar is:**
```bash
docker exec app-all-in-one ping -c 2 rabbitmq
```

### Probleem: Nginx geeft 502 Bad Gateway

Dit betekent dat Nginx de API niet kan bereiken.

**Check:**
```bash
# Check of API draait
docker exec app-all-in-one supervisorctl status api

# Test API direct
docker exec app-all-in-one curl http://localhost:3000/health

# Check Nginx config
docker exec app-all-in-one nginx -t
```

### Restart services
```bash
docker exec app-all-in-one supervisorctl restart api
docker exec app-all-in-one supervisorctl restart consumer
docker exec app-all-in-one supervisorctl restart nginx
```

### View logs
```bash
# All logs
docker logs -f app-all-in-one

# Supervisor logs
docker exec app-all-in-one cat /var/log/supervisor/supervisord.log

# API logs
docker exec app-all-in-one tail -f /var/log/supervisor/api.out.log

# Consumer logs
docker exec app-all-in-one tail -f /var/log/supervisor/consumer.out.log

# Nginx logs
docker exec app-all-in-one tail -f /var/log/nginx/access.log
```

## 🏗️ Build Process

De Dockerfile gebruikt multi-stage builds:

1. **backend-deps**: Installeer backend dependencies
2. **frontend-deps**: Installeer frontend dependencies
3. **backend-build**: Build TypeScript → JavaScript
4. **frontend-build**: Build React → Static files
5. **production**: Combineer alles + Supervisor + Nginx

## 📊 Architecture

```
┌─────────────────────────────────┐
│     Docker Container            │
│  ┌───────────────────────────┐   │
│  │   Supervisor (root)      │   │
│  │  ┌─────────────────────┐ │   │
│  │  │ API (nodejs user)   │ │   │
│  │  │ Port: 3000          │ │   │
│  │  └─────────────────────┘ │   │
│  │  ┌─────────────────────┐ │   │
│  │  │ Consumer (nodejs)   │ │   │
│  │  └─────────────────────┘ │   │
│  │  ┌─────────────────────┐ │   │
│  │  │ Nginx (root)       │ │   │
│  │  │ Port: 80           │ │   │
│  │  │ - Serves frontend   │ │   │
│  │  │ - Proxies /api      │ │   │
│  │  └─────────────────────┘ │   │
│  └───────────────────────────┘   │
└─────────────────────────────────┘
```

## 🔐 Security

- Node.js processen draaien als `nodejs` user (non-root)
- Nginx draait als root (vereist voor port 80)
- Supervisor beheert alle processen

## 📚 Meer Info

Zie `DOCKER.md` voor uitgebreide documentatie.
