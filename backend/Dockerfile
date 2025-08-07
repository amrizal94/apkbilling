# Multi-stage Dockerfile for production
FROM node:18-alpine as base

# Install system dependencies
RUN apk add --no-cache \
    curl \
    dumb-init \
    python3 \
    make \
    g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Production dependencies
FROM base as production-deps
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base as build
RUN npm ci
COPY . .
# Add any build steps here if needed

# Production stage
FROM node:18-alpine as production

# Install only curl for health checks
RUN apk add --no-cache curl dumb-init

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=production-deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/src ./src
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./

# Create necessary directories
RUN mkdir -p uploads logs && \
    chown -R nodejs:nodejs uploads logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "src/server.js"]