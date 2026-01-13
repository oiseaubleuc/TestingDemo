#!/bin/sh
# Test script voor Docker container

echo "=========================================="
echo "Testing Docker Container"
echo "=========================================="

# Check if container is running
if ! docker ps | grep -q app-all-in-one; then
    echo "❌ Container 'app-all-in-one' is niet actief!"
    echo "Start met: docker-compose up -d"
    exit 1
fi

echo ""
echo "1. Checking container status..."
docker ps | grep app-all-in-one

echo ""
echo "2. Checking supervisor processes..."
docker exec app-all-in-one supervisorctl status

echo ""
echo "3. Testing API health endpoint (direct)..."
if curl -f -s http://localhost:3000/health > /dev/null; then
    echo "✅ API direct (port 3000): OK"
    curl -s http://localhost:3000/health | jq . || curl -s http://localhost:3000/health
else
    echo "❌ API direct (port 3000): FAILED"
    echo "   Check logs: docker logs app-all-in-one"
fi

echo ""
echo "4. Testing Frontend via Nginx (port 80 -> 5173)..."
if curl -f -s http://localhost:5173 > /dev/null; then
    echo "✅ Frontend via Nginx (port 5173): OK"
else
    echo "❌ Frontend via Nginx (port 5173): FAILED"
    echo "   Check nginx logs: docker exec app-all-in-one cat /var/log/supervisor/nginx.err.log"
fi

echo ""
echo "5. Testing API via Nginx proxy..."
if curl -f -s http://localhost:5173/api/candies > /dev/null; then
    echo "✅ API via Nginx proxy (/api): OK"
else
    echo "❌ API via Nginx proxy (/api): FAILED"
fi

echo ""
echo "6. Testing health endpoint via Nginx..."
if curl -f -s http://localhost:5173/health > /dev/null; then
    echo "✅ Health via Nginx proxy (/health): OK"
    curl -s http://localhost:5173/health | jq . || curl -s http://localhost:5173/health
else
    echo "❌ Health via Nginx proxy (/health): FAILED"
fi

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Container: app-all-in-one"
echo "API Direct: http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo "API Proxy: http://localhost:5173/api"
echo ""
