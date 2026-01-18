FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm and dependencies for sharp
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache python3 make g++

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/media-server/package.json ./apps/media-server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/shared ./packages/shared
COPY apps/media-server ./apps/media-server

# Build shared package first, then media-server
RUN pnpm --filter @feed/shared build 2>/dev/null || true
RUN pnpm --filter @feed/media-server build

# Production image
FROM node:22-alpine

WORKDIR /app

# Install production dependencies
# vips-dev for sharp, ffmpeg for video metadata extraction
RUN apk add --no-cache vips-dev ffmpeg

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/media-server/package.json ./apps/media-server/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/media-server/dist ./apps/media-server/dist

# Create uploads directory
RUN mkdir -p /uploads/images /uploads/videos

ENV NODE_ENV=production
ENV PORT=3001
ENV UPLOAD_DIR=/uploads

WORKDIR /app/apps/media-server

EXPOSE 3001

CMD ["node", "dist/index.js"]
