# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN pnpm build

# Stage 3: Production
FROM node:22-alpine AS runner

# Create non-root user early to avoid slow chown on node_modules
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

WORKDIR /app

# Install pnpm and set NODE_ENV
RUN npm install -g pnpm@9
ENV NODE_ENV production

# Copy necessary files for production (owned by nestjs)
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/pnpm-lock.yaml ./

# Install only production dependencies (as root, then switch user)
RUN pnpm install --prod --frozen-lockfile && \
    chown -R nestjs:nodejs /app/node_modules
USER nestjs

# Expose the port specified by the PORT environment variable (default: 3001)
ENV PORT 300
EXPOSE ${PORT}

# Health check to verify app is running
# HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
#   CMD wget -q -O - http://localhost:${PORT}/api/v1/health || exit 1

# Command to run the application
CMD ["node", "dist/main"] 