import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { statfs } from 'fs/promises';
import { nanoid } from 'nanoid';
import { fileTypeFromBuffer } from 'file-type';
import { extractImageMetadata, extractVideoMetadata } from './metadata.js';

const app = express();

// Trust proxy (required when behind reverse proxy like Coolify/Traefik)
app.set('trust proxy', 1);

// Configuration
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const API_KEY = process.env.API_KEY;
const MIN_FREE_SPACE_MB = parseInt(process.env.MIN_FREE_SPACE_MB || '500', 10);

// Server instance for graceful shutdown
let server: ReturnType<typeof app.listen>;

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
]);

const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/x-matroska',
]);

// Ensure upload directories exist
async function ensureDirectories() {
  await fs.mkdir(path.join(UPLOAD_DIR, 'images'), { recursive: true });
  await fs.mkdir(path.join(UPLOAD_DIR, 'videos'), { recursive: true });
}

// Get disk space info
async function getDiskSpace(): Promise<{
  total: number;
  free: number;
  used: number;
  usedPercent: number;
}> {
  try {
    const stats = await statfs(UPLOAD_DIR);
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    const used = total - free;
    return {
      total,
      free,
      used,
      usedPercent: Math.round((used / total) * 100 * 10) / 10,
    };
  } catch {
    return { total: 0, free: 0, used: 0, usedPercent: 0 };
  }
}

// Check if there's enough disk space
async function hasEnoughSpace(requiredBytes: number): Promise<boolean> {
  const { free } = await getDiskSpace();
  const minFreeBytes = MIN_FREE_SPACE_MB * 1024 * 1024;
  return free - requiredBytes > minFreeBytes;
}

// Get directory size recursively
async function getDirectorySize(dirPath: string): Promise<number> {
  let size = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        size += stat.size;
      } else if (entry.isDirectory()) {
        size += await getDirectorySize(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return size;
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Disable CSP for media serving
  })
);

// Request logging
app.use(
  morgan('combined', {
    skip: (req) => req.url === '/health', // Skip health checks
  })
);

// Rate limiting for upload endpoint
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 uploads per minute
  message: { error: 'Too many uploads, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for general API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Multer configuration for memory storage (we process before saving)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
});

// CORS - allow Sanity Studio origins
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

// API Key authentication middleware
function authenticate(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!API_KEY) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  if (token !== API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
}

// Health check (no rate limiting)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Stats endpoint - disk space and file counts
app.get('/stats', authenticate, apiLimiter, async (_req, res) => {
  try {
    const disk = await getDiskSpace();
    const imagesSize = await getDirectorySize(path.join(UPLOAD_DIR, 'images'));
    const videosSize = await getDirectorySize(path.join(UPLOAD_DIR, 'videos'));

    // Count files
    let imageCount = 0;
    let videoCount = 0;
    try {
      const imageFiles = await fs.readdir(path.join(UPLOAD_DIR, 'images'));
      imageCount = imageFiles.length;
    } catch {
      /* empty */
    }
    try {
      const videoFiles = await fs.readdir(path.join(UPLOAD_DIR, 'videos'));
      videoCount = videoFiles.length;
    } catch {
      /* empty */
    }

    res.json({
      disk: {
        total: disk.total,
        totalFormatted: formatBytes(disk.total),
        free: disk.free,
        freeFormatted: formatBytes(disk.free),
        used: disk.used,
        usedFormatted: formatBytes(disk.used),
        usedPercent: disk.usedPercent,
      },
      storage: {
        images: {
          count: imageCount,
          size: imagesSize,
          sizeFormatted: formatBytes(imagesSize),
        },
        videos: {
          count: videoCount,
          size: videosSize,
          sizeFormatted: formatBytes(videosSize),
        },
        total: {
          count: imageCount + videoCount,
          size: imagesSize + videosSize,
          sizeFormatted: formatBytes(imagesSize + videosSize),
        },
      },
      config: {
        minFreeSpaceMB: MIN_FREE_SPACE_MB,
        maxFileSizeMB: 500,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Upload endpoint
app.post(
  '/upload',
  authenticate,
  uploadLimiter,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const { buffer, originalname, mimetype: clientMimeType, size } = req.file;

      // Validate file type from actual content (not client-provided mime type)
      const detectedType = await fileTypeFromBuffer(buffer);
      const actualMimeType = detectedType?.mime || clientMimeType;

      const isImage = ALLOWED_IMAGE_TYPES.has(actualMimeType);
      const isVideo = ALLOWED_VIDEO_TYPES.has(actualMimeType);

      if (!isImage && !isVideo) {
        return res.status(400).json({
          error: 'Unsupported file type',
          detected: actualMimeType,
          allowed: {
            images: Array.from(ALLOWED_IMAGE_TYPES),
            videos: Array.from(ALLOWED_VIDEO_TYPES),
          },
        });
      }

      // Check disk space before proceeding
      if (!(await hasEnoughSpace(size))) {
        return res.status(507).json({
          error: 'Insufficient storage space',
          message: `Server requires at least ${MIN_FREE_SPACE_MB}MB free space`,
        });
      }

      // Generate unique filename with correct extension
      const ext = detectedType?.ext
        ? `.${detectedType.ext}`
        : path.extname(originalname).toLowerCase();
      const id = nanoid(12);
      const filename = `${id}${ext}`;
      const subdir = isImage ? 'images' : 'videos';
      const filePath = path.join(UPLOAD_DIR, subdir, filename);

      let metadata: Record<string, unknown> = {};

      if (isImage) {
        const imageMetadata = await extractImageMetadata(buffer);
        metadata = {
          ...imageMetadata,
          type: 'image',
        };
      }

      // Save file first (needed for video ffprobe)
      await fs.writeFile(filePath, buffer);

      if (isVideo) {
        const videoMetadata = await extractVideoMetadata(filePath, actualMimeType);
        metadata = {
          ...videoMetadata,
          type: 'video',
        };
      }

      // Build response
      const url = `${PUBLIC_URL}/files/${subdir}/${filename}`;

      res.json({
        success: true,
        id,
        url,
        originalFilename: originalname,
        mimeType: actualMimeType,
        size,
        ...metadata,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// List all files endpoint
app.get('/list', authenticate, apiLimiter, async (_req, res) => {
  try {
    const images: Array<{
      id: string;
      filename: string;
      url: string;
      type: 'image';
      mtime: Date;
      size: number;
    }> = [];
    const videos: Array<{
      id: string;
      filename: string;
      url: string;
      type: 'video';
      mtime: Date;
      size: number;
    }> = [];

    // Read images directory
    const imageDir = path.join(UPLOAD_DIR, 'images');
    try {
      const imageFiles = await fs.readdir(imageDir);
      for (const filename of imageFiles) {
        const filePath = path.join(imageDir, filename);
        const stat = await fs.stat(filePath);
        const id = path.basename(filename, path.extname(filename));
        images.push({
          id,
          filename,
          url: `${PUBLIC_URL}/files/images/${filename}`,
          type: 'image',
          mtime: stat.mtime,
          size: stat.size,
        });
      }
    } catch {
      // Directory might not exist yet
    }

    // Read videos directory
    const videoDir = path.join(UPLOAD_DIR, 'videos');
    try {
      const videoFiles = await fs.readdir(videoDir);
      for (const filename of videoFiles) {
        const filePath = path.join(videoDir, filename);
        const stat = await fs.stat(filePath);
        const id = path.basename(filename, path.extname(filename));
        videos.push({
          id,
          filename,
          url: `${PUBLIC_URL}/files/videos/${filename}`,
          type: 'video',
          mtime: stat.mtime,
          size: stat.size,
        });
      }
    } catch {
      // Directory might not exist yet
    }

    // Sort by modification time (newest first)
    images.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    videos.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    res.set('Cache-Control', 'no-store');
    res.json({
      images,
      videos,
      total: images.length + videos.length,
    });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Delete endpoint
app.delete(
  '/files/:type/:filename',
  authenticate,
  apiLimiter,
  async (req, res) => {
    try {
      const { type, filename } = req.params;

      if (type !== 'images' && type !== 'videos') {
        return res.status(400).json({ error: 'Invalid file type' });
      }

      // Sanitize filename to prevent directory traversal
      const sanitizedFilename = path.basename(filename);
      const filePath = path.join(UPLOAD_DIR, type, sanitizedFilename);

      await fs.unlink(filePath);
      res.json({ success: true, deleted: filename });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
      }
      console.error('Delete error:', error);
      res.status(500).json({ error: 'Delete failed' });
    }
  }
);

// Static file serving
app.use(
  '/files',
  express.static(UPLOAD_DIR, {
    maxAge: '1y',
    immutable: true,
    etag: true,
    lastModified: true,
  })
);

// Graceful shutdown handler
function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close((err) => {
    if (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
    console.log('Server closed. Exiting.');
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forcefully shutting down after timeout');
    process.exit(1);
  }, 10000);
}

// Start server
async function start() {
  await ensureDirectories();

  server = app.listen(PORT, () => {
    console.log(`Media server running on port ${PORT}`);
    console.log(`Public URL: ${PUBLIC_URL}`);
    console.log(`Upload directory: ${path.resolve(UPLOAD_DIR)}`);
    console.log(`API key required: ${API_KEY ? 'yes' : 'no'}`);
    console.log(`Minimum free space: ${MIN_FREE_SPACE_MB}MB`);
  });

  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

start().catch(console.error);
