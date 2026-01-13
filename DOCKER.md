# Docker Setup & Deployment Guide

## 📋 Inhoudsopgave

1. [Overzicht](#overzicht)
2. [Vereisten](#vereisten)
3. [Quick Start](#quick-start)
4. [Docker Images](#docker-images)
5. [Docker Compose](#docker-compose)
6. [Environment Variabelen](#environment-variabelen)
7. [Development Workflow](#development-workflow)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Overzicht

Dit project gebruikt Docker voor containerisatie van alle services:

- **Backend API** (`Dockerfile.backend`) - Express.js API server
- **Frontend** (`Dockerfile.frontend`) - React app met Nginx
- **Consumer** (`Dockerfile.consumer`) - RabbitMQ consumer worker
- **RabbitMQ** - Message queue (officiële image)

Alle services worden beheerd via `docker-compose.yml`.

---

## 📦 Vereisten

- **Docker Engine** 20.10 of hoger
- **Docker Compose** 2.0 of hoger
- **Minimaal 2GB RAM** beschikbaar voor containers

### Installatie Check

```bash
docker --version
docker-compose --version
```

---

## 🚀 Quick Start

### Stap 1: Environment Setup

```bash
# Kopieer het voorbeeld bestand
cp docker-compose.env.example .env

# Bewerk .env en vul je credentials in
nano .env  # of gebruik je favoriete editor
```

### Stap 2: Start Alle Services

```bash
# Build en start alle services
docker-compose up -d

# Bekijk logs
docker-compose logs -f
```

### Stap 3: Verifieer Services

```bash
# Check status
docker-compose ps

# Test API
curl http://localhost:3000/health

# Test RabbitMQ Management UI
open http://localhost:15672
# Login: guest / guest

# Test Frontend
open http://localhost:5173
```

---

## 🐳 Docker Images

### Backend Image

**Build:**
```bash
docker build -f Dockerfile.backend -t rabbitmq-salesforce-backend:latest .
```

**Run:**
```bash
docker run -d \
  --name api-server \
  -p 3000:3000 \
  --env-file .env \
  rabbitmq-salesforce-backend:latest
```

**Details:**
- Base: `node:18-alpine`
- Multi-stage build (dependencies → build → production)
- Non-root user voor security
- Health check endpoint
- Port: 3000

### Frontend Image

**Build:**
```bash
docker build -f Dockerfile.frontend -t rabbitmq-salesforce-frontend:latest .
```

**Run:**
```bash
docker run -d \
  --name frontend-app \
  -p 5173:80 \
  rabbitmq-salesforce-frontend:latest
```

**Details:**
- Base: `nginx:alpine`
- Multi-stage build (dependencies → build → nginx)
- SPA routing support
- Gzip compression
- Port: 80 (mapt naar 5173 op host)

### Consumer Image

**Build:**
```bash
docker build -f Dockerfile.consumer -t rabbitmq-salesforce-consumer:latest .
```

**Run:**
```bash
docker run -d \
  --name consumer-worker \
  --env-file .env \
  --network app-network \
  rabbitmq-salesforce-consumer:latest
```

**Details:**
- Base: `node:18-alpine`
- Multi-stage build
- Non-root user
- Process health check
- Geen exposed ports (intern alleen)

---

## 🎛️ Docker Compose

### Services Overzicht

| Service | Image | Ports | Depends On |
|---------|-------|-------|------------|
| `rabbitmq` | `rabbitmq:3-management-alpine` | 5672, 15672 | - |
| `api` | `Dockerfile.backend` | 3000 | rabbitmq |
| `consumer` | `Dockerfile.consumer` | - | rabbitmq, api |
| `frontend` | `Dockerfile.frontend` | 5173 | api |

### Belangrijke Commands

```bash
# Start alle services
docker-compose up -d

# Stop alle services
docker-compose down

# Stop en verwijder volumes (⚠️ data loss)
docker-compose down -v

# Rebuild images
docker-compose build --no-cache

# Restart specifieke service
docker-compose restart api

# Bekijk logs
docker-compose logs -f
docker-compose logs -f api
docker-compose logs -f consumer

# Execute command in container
docker-compose exec api sh
docker-compose exec rabbitmq rabbitmqctl status

# Scale services (indien nodig)
docker-compose up -d --scale consumer=3
```

### Service Health Checks

Alle services hebben health checks:

```bash
# Check health status
docker-compose ps

# Health check output:
# - healthy: Service werkt correct
# - unhealthy: Service heeft problemen
# - starting: Service is aan het opstarten
```

---

## 🔐 Environment Variabelen

### Vereiste Variabelen

Zie `docker-compose.env.example` voor volledige lijst.

**Minimaal vereist:**
- `RABBITMQ_URL`
- `SALESFORCE_INSTANCE_URL`
- `SALESFORCE_CLIENT_ID`
- `SALESFORCE_CLIENT_SECRET`
- `SALESFORCE_REFRESH_TOKEN` (of `SALESFORCE_USERNAME` + `SALESFORCE_PASSWORD`)

### Environment File Setup

```bash
# Kopieer voorbeeld
cp docker-compose.env.example .env

# Bewerk .env
nano .env
```

**Belangrijk:** `.env` staat in `.gitignore` en wordt niet gecommit!

---

## 💻 Development Workflow

### Optie 1: Volledig Docker

```bash
# Start alles met Docker
docker-compose up -d

# Bekijk logs
docker-compose logs -f

# Stop
docker-compose down
```

### Optie 2: Hybride (RabbitMQ in Docker, rest lokaal)

```bash
# Start alleen RabbitMQ
docker-compose up -d rabbitmq

# Start API lokaal
npm run start:api

# Start Consumer lokaal
npm run start:consumer

# Start Frontend lokaal
npm run start:frontend
```

### Optie 3: Development met Hot Reload

Voor development met hot reload, gebruik lokale development servers:

```bash
# RabbitMQ in Docker
docker-compose up -d rabbitmq

# API met ts-node (hot reload)
npm run start:api

# Frontend met Vite (hot reload)
cd frontend && npm run dev
```

---

## 🔧 Troubleshooting

### Probleem: Services starten niet

**Oplossing:**
```bash
# Check logs
docker-compose logs

# Check Docker status
docker ps -a

# Rebuild images
docker-compose build --no-cache
docker-compose up -d
```

### Probleem: Port conflicts

**Oplossing:**
```bash
# Check welke ports in gebruik zijn
lsof -i :3000
lsof -i :5672
lsof -i :15672

# Wijzig ports in docker-compose.yml of .env
```

### Probleem: RabbitMQ connection refused

**Oplossing:**
```bash
# Check RabbitMQ status
docker-compose exec rabbitmq rabbitmqctl status

# Check RabbitMQ logs
docker-compose logs rabbitmq

# Restart RabbitMQ
docker-compose restart rabbitmq
```

### Probleem: Frontend kan API niet bereiken

**Oplossing:**
```bash
# Check of API draait
curl http://localhost:3000/health

# Check network
docker-compose exec frontend ping api

# Update VITE_API_URL in frontend/.env
```

### Probleem: Consumer verwerkt geen berichten

**Oplossing:**
```bash
# Check consumer logs
docker-compose logs -f consumer

# Check RabbitMQ queue
# Ga naar http://localhost:15672
# Login: guest / guest
# Bekijk queues tab

# Check Salesforce credentials
docker-compose exec consumer env | grep SALESFORCE
```

### Probleem: Out of memory

**Oplossing:**
```bash
# Check memory usage
docker stats

# Stop onnodige containers
docker-compose down

# Verhoog Docker memory limit in Docker Desktop settings
```

### Probleem: Images niet up-to-date

**Oplossing:**
```bash
# Rebuild zonder cache
docker-compose build --no-cache

# Of verwijder oude images
docker-compose down
docker rmi $(docker images -q rabbitmq-salesforce-*)
docker-compose build
```

---

## 📊 Monitoring

### Container Stats

```bash
# Real-time stats
docker stats

# Specifieke container
docker stats api-server
```

### Logs

```bash
# Alle logs
docker-compose logs -f

# Laatste 100 regels
docker-compose logs --tail=100

# Sinds 10 minuten
docker-compose logs --since 10m
```

### RabbitMQ Management

- URL: http://localhost:15672
- Username: `guest`
- Password: `guest`

---

## 🚢 Production Deployment

### Best Practices

1. **Security:**
   - Gebruik secrets management (Docker Secrets, Kubernetes Secrets)
   - Non-root users in containers
   - Minimal base images (alpine)

2. **Performance:**
   - Resource limits instellen
   - Health checks configureren
   - Logging naar externe service

3. **Reliability:**
   - Restart policies (`restart: unless-stopped`)
   - Health checks
   - Graceful shutdown

### Production Docker Compose

Voor productie, overweeg:
- Externe RabbitMQ (managed service)
- Load balancer voor API
- CDN voor frontend
- Monitoring stack (Prometheus, Grafana)

---

## 📚 Extra Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [RabbitMQ Docker Hub](https://hub.docker.com/_/rabbitmq)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

---

## ❓ Vragen?

Open een issue in de repository of neem contact op met het development team.
