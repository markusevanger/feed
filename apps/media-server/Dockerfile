FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm and dependencies for sharp
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache python3 make g++

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared ./packages/shared
COPY apps/media-server ./apps/media-server

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build media-server
WORKDIR /app/apps/media-server
RUN pnpm build

# Debug: verify build output exists
RUN ls -la dist/

# Production image
FROM node:22-alpine

WORKDIR /app

# Install production dependencies
# vips-dev for sharp, ffmpeg for video metadata extraction
RUN apk add --no-cache vips-dev ffmpeg

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files for pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared ./packages/shared
COPY apps/media-server/package.json ./apps/media-server/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder
COPY --from=builder /app/apps/media-server/dist ./apps/media-server/dist

# Create uploads directory
RUN mkdir -p /uploads/images /uploads/videos

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

ENV NODE_ENV=production
ENV PORT=3001
ENV UPLOAD_DIR=/uploads

WORKDIR /app/apps/media-server

EXPOSE 3001

CMD ["node", "dist/apps/media-server/src/index.js"]
