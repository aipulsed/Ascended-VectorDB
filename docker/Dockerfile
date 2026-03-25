# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client and build
RUN pnpm db:generate && pnpm build

# ─────────────────────────────────────────────
# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files and install production deps only
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

# Copy built output and Prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/index.js"]
