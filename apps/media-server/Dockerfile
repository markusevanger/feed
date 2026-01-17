FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies for sharp
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Production image
FROM node:22-alpine

WORKDIR /app

# Install production dependencies only
# vips-dev for sharp, ffmpeg for video metadata extraction
RUN apk add --no-cache vips-dev ffmpeg

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p /uploads/images /uploads/videos

ENV NODE_ENV=production
ENV PORT=3001
ENV UPLOAD_DIR=/uploads

EXPOSE 3001

CMD ["node", "dist/index.js"]
