# Multi-stage build for frontend optimization
# Stage 1: Install dependencies
FROM node:26-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install && \
    npm cache clean --force

# Stage 2: Build the application
FROM node:26-alpine AS builder
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

# Set build-time API URL
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# Stage 3: Production runner
FROM node:26-alpine AS runner
WORKDIR /usr/src/app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/next.config.js ./next.config.js

# Set permissions
RUN chown -R nextjs:nodejs /usr/src/app

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["npm", "start"]
