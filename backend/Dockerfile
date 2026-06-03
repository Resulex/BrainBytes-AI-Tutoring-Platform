# Multi-stage build for container optimization
# Stage 1: Install production dependencies
FROM node:26-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --production && \
    npm cache clean --force

# Stage 2: Production image
FROM node:26-alpine AS runner
WORKDIR /usr/src/app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy only production dependencies from deps stage
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

# Set proper permissions
RUN chown -R appuser:nodejs /usr/src/app

USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
