# Multi-stage build for frontend optimization
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package*.json ./
RUN for i in $(seq 1 3); do \
        npm install --legacy-peer-deps && \
        break || sleep 10; \
    done && \
    npm cache clean --force

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

# Set build-time API URL
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# Stage 3: Production deps
FROM node:20-alpine AS prod-deps
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/package-lock.json ./package-lock.json
RUN for i in $(seq 1 3); do \
        npm install --omit=dev --legacy-peer-deps && \
        break || sleep 10; \
    done && \
    npm cache clean --force

# Stage 4: Production runner
FROM node:20-alpine AS runner
WORKDIR /usr/src/app

# Upgrade Alpine packages (patch OS CVEs like libcrypto3/libssl3)
# and upgrade npm to patch CVEs in bundled npm deps (cross-spawn, glob, minimatch, tar)
# Retry loops handle transient I/O errors from Alpine CDN / npm registry in CI
RUN for i in $(seq 1 5); do \
        apk update && \
        apk upgrade && \
        apk add wget && \
        break || sleep 10; \
    done && \
    rm -rf /var/cache/apk/* && \
    for i in $(seq 1 5); do \
        npm install -g npm@latest && \
        break || sleep 10; \
    done && \
    npm cache clean --force

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/.next ./.next
COPY --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/next.config.js ./next.config.js

# Set permissions
RUN chown -R nextjs:nodejs /usr/src/app

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=15s --timeout=10s --start-period=40s --retries=5 \
  CMD wget -q -O /dev/null http://localhost:3000/health || exit 1

CMD ["npm", "start"]
