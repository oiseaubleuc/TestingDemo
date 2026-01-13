# Testing Guide

## 🧪 Quick Test

```bash
# Run test script
./docker/test.sh
```

## 📋 Manual Testing

### 1. Check Container Status

```bash
# Check if running
docker ps | grep app-all-in-one

# Check supervisor processes
docker exec app-all-in-one supervisorctl status
```

**Expected output:**
```
api                              RUNNING   pid 10, uptime 0:00:05
consumer                         RUNNING   pid 11, uptime 0:00:05
nginx                            RUNNING   pid 12, uptime 0:00:05
```

### 2. Test API Direct (Port 3000)

```bash
# Health check
curl http://localhost:3000/health

# Expected: {"status":"ok","service":"producer-api"}

# Get candies
curl http://localhost:3000/api/candies

# Queue info
curl http://localhost:3000/queue/info
```

### 3. Test Frontend (Port 5173)

```bash
# Frontend HTML
curl http://localhost:5173

# Should return HTML content

# Health via Nginx proxy
curl http://localhost:5173/health

# API via Nginx proxy
curl http://localhost:5173/api/candies
```

### 4. Test in Browser

- **Frontend:** http://localhost:5173
- **API Direct:** http://localhost:3000/health
- **RabbitMQ UI:** http://localhost:15672 (guest/guest)

## 🔍 Troubleshooting Tests

### Test 1: Container niet actief

**Symptoom:**
```bash
$ curl http://localhost:3000/health
curl: (7) Failed to connect to localhost port 3000
```

**Oplossing:**
```bash
docker-compose up -d
docker ps | grep app-all-in-one
```

### Test 2: API niet bereikbaar

**Symptoom:**
```bash
$ curl http://localhost:3000/health
curl: (7) Failed to connect to localhost port 3000
```

**Check:**
```bash
# Check if API process is running
docker exec app-all-in-one supervisorctl status api

# Check API logs
docker exec app-all-in-one cat /var/log/supervisor/api.err.log

# Test from inside container
docker exec app-all-in-one curl http://localhost:3000/health
```

**Oplossing:**
```bash
# Restart API
docker exec app-all-in-one supervisorctl restart api

# Or rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Test 3: Nginx geeft 502 Bad Gateway

**Symptoom:**
```bash
$ curl http://localhost:5173/api/candies
<html>
<head><title>502 Bad Gateway</title></head>
...
```

**Check:**
```bash
# Check if API is running
docker exec app-all-in-one supervisorctl status api

# Test API direct
docker exec app-all-in-one curl http://localhost:3000/health

# Check Nginx error logs
docker exec app-all-in-one cat /var/log/supervisor/nginx.err.log
```

**Oplossing:**
```bash
# Restart both
docker exec app-all-in-one supervisorctl restart api
docker exec app-all-in-one supervisorctl restart nginx
```

### Test 4: Frontend toont niets

**Symptoom:**
```bash
$ curl http://localhost:5173
# Returns empty or 404
```

**Check:**
```bash
# Check if Nginx is running
docker exec app-all-in-one supervisorctl status nginx

# Check if frontend files exist
docker exec app-all-in-one ls -la /usr/share/nginx/html

# Check Nginx config
docker exec app-all-in-one nginx -t
```

**Oplossing:**
```bash
# Rebuild frontend
docker-compose build --no-cache
docker-compose up -d
```

## ✅ Success Criteria

Alle tests moeten slagen:

- [ ] Container draait (`docker ps`)
- [ ] Alle 3 supervisor processen zijn RUNNING
- [ ] `curl http://localhost:3000/health` retourneert JSON
- [ ] `curl http://localhost:5173` retourneert HTML
- [ ] `curl http://localhost:5173/api/candies` retourneert JSON
- [ ] Browser toont frontend op http://localhost:5173

## 🚀 Automated Testing

```bash
# Run full test suite
./docker/test.sh

# Expected output:
# ✅ API direct (port 3000): OK
# ✅ Frontend via Nginx (port 5173): OK
# ✅ API via Nginx proxy (/api): OK
# ✅ Health via Nginx proxy (/health): OK
```
