FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    krb5-dev

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mssql -u 1001 -G nodejs

# Change ownership
RUN chown -R mssql:nodejs /app

USER mssql

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8002/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

EXPOSE 8002

CMD ["npm", "start"]