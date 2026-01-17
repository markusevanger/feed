# Feed Media Server

Self-hosted media server for the Feed project. Handles image/video uploads with automatic metadata extraction.

## Features

- Image uploads with automatic LQIP (blur placeholder) generation
- EXIF metadata extraction (date, lens info, GPS location)
- Video uploads with MIME type detection
- Simple REST API with optional API key authentication
- Docker-ready for easy deployment

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

### Docker

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# Build and run
docker compose up -d
```

## API

### Upload File

```bash
POST /upload
Content-Type: multipart/form-data
Authorization: Bearer <API_KEY>  # Optional, if API_KEY is configured

# Form field: file
```

**Response (Image):**
```json
{
  "success": true,
  "id": "abc123xyz789",
  "url": "https://media.example.com/files/images/abc123xyz789.jpg",
  "originalFilename": "photo.jpg",
  "mimeType": "image/jpeg",
  "size": 2048576,
  "type": "image",
  "width": 1920,
  "height": 1080,
  "aspectRatio": 1.7778,
  "lqip": "data:image/jpeg;base64,/9j/4AAQ...",
  "exif": {
    "dateTime": "2024-01-15T14:30:00",
    "lensMake": "Sony",
    "lensModel": "FE 24-70mm F2.8 GM"
  },
  "location": {
    "lat": 59.9241,
    "lon": 10.7583
  }
}
```

**Response (Video):**
```json
{
  "success": true,
  "id": "def456uvw123",
  "url": "https://media.example.com/files/videos/def456uvw123.mp4",
  "originalFilename": "clip.mp4",
  "mimeType": "video/mp4",
  "size": 15728640,
  "type": "video"
}
```

### Delete File

```bash
DELETE /files/:type/:filename
Authorization: Bearer <API_KEY>
```

### Health Check

```bash
GET /health
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `UPLOAD_DIR` | Directory for uploads | `./uploads` |
| `PUBLIC_URL` | Base URL for generated file URLs | `http://localhost:3001` |
| `API_KEY` | Optional API key for authentication | (none) |

## Production Deployment

For production, use the included `Caddyfile.example` with Caddy as a reverse proxy:

1. Caddy handles HTTPS automatically
2. Static files are served directly by Caddy (faster)
3. Upload requests are proxied to the Node.js API

```yaml
# docker-compose.prod.yml
services:
  media-api:
    build: .
    environment:
      - PUBLIC_URL=https://media.yourdomain.com
      - API_KEY=${API_KEY}
    volumes:
      - ./uploads:/uploads

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - ./uploads:/srv/files:ro
      - caddy_data:/data
```
