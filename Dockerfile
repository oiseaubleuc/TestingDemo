# ============================================
# Unified Dockerfile - All-in-One
# ============================================
# Builds backend, frontend, and runs everything in one container

# ============================================
# Stage 1: Backend Dependencies
# ============================================
FROM node:18-alpine AS backend-deps

WORKDIR /app

# Copy backend package files
COPY package*.json ./
COPY tsconfig.json ./

# Install backend dependencies
RUN npm ci && npm cache clean --force

# ============================================
# Stage 2: Frontend Dependencies
# ============================================
FROM node:18-alpine AS frontend-deps

WORKDIR /app

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci && npm cache clean --force

# ============================================
# Stage 3: Build Backend
# ============================================
FROM node:18-alpine AS backend-build

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev)
RUN npm ci && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN npm run build

# ============================================
# Stage 4: Build Frontend
# ============================================
FROM node:18-alpine AS frontend-build

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# ============================================
# Stage 5: Production Image
# ============================================
FROM node:18-alpine AS production

WORKDIR /app

# Install dumb-init, nginx, and supervisor
RUN apk add --no-cache \
    dumb-init \
    nginx \
    supervisor \
    curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy backend package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built backend from build stage
COPY --from=backend-build /app/dist ./dist

# Copy frontend build to nginx html directory
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Copy data files
COPY data/ ./data/

# Copy nginx configuration
# Alpine nginx uses http.d instead of conf.d
COPY docker/nginx-unified.conf /etc/nginx/http.d/default.conf

# Copy supervisor configuration
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create necessary directories
RUN mkdir -p logs /var/log/supervisor /var/run/nginx /var/log/nginx && \
    chown -R nodejs:nodejs /app /var/log/supervisor && \
    chown -R nginx:nginx /usr/share/nginx/html /var/log/nginx /var/run/nginx

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo 'echo "Starting all services..."' >> /app/start.sh && \
    echo 'exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose ports
EXPOSE 3000 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health && curl -f http://localhost/ || exit 1

# Use dumb-init to handle signals properly
# Note: supervisord moet als root draaien om nginx te kunnen starten
ENTRYPOINT ["dumb-init", "--"]

# Start supervisor which manages all services
CMD ["/app/start.sh"]
