# ==========================================
# Stage 1: Build
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy dependency files
COPY package*.json ./
COPY prisma/ ./prisma/

# Install dependencies, including dev dependencies needed for TypeScript build
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npx tsc --outDir dist

# Remove devDependencies
RUN npm prune --omit=dev

# ==========================================
# Stage 2: Production
# ==========================================
FROM node:20-alpine

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Install OpenSSL for Prisma runtime
RUN apk add --no-cache openssl tzdata

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# Create persistent runtime directories
RUN mkdir -p /app/temp /app/uploads /app/backups && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health/live || exit 1

EXPOSE 5000

VOLUME ["/app/uploads", "/app/backups", "/app/temp"]

CMD ["node", "dist/server.js"]
