import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { statfs } from 'fs/promises';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';
import { fileTypeFromBuffer } from 'file-type';
import { extractImageMetadata, extractVideoMetadata, extractVideoThumbnail } from './metadata.js';
import {
  analyzeVideoCodecs,
  needsTranscoding,
  transcodeVideo,
  checkFfmpegAvailable,
  cleanupOrphanedTempFiles,
} from './transcode.js';

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
  await fs.mkdir(path.join(UPLOAD_DIR, 'thumbnails'), { recursive: true });
}

// Hash index for duplicate detection
interface HashEntry {
  hash: string;
  filename: string;
  type: 'image' | 'video';
  url: string;
}

const HASH_INDEX_FILE = path.join(UPLOAD_DIR, '.hash-index.json');
let hashIndex: Map<string, HashEntry> = new Map();

// Load hash index from disk
async function loadHashIndex(): Promise<void> {
  try {
    const data = await fs.readFile(HASH_INDEX_FILE, 'utf-8');
    const entries: HashEntry[] = JSON.parse(data);
    hashIndex = new Map(entries.map((e) => [e.hash, e]));
    console.log(`Loaded ${hashIndex.size} entries from hash index`);
  } catch {
    // Index doesn't exist yet, start fresh
    hashIndex = new Map();
  }
}

// Save hash index to disk
async function saveHashIndex(): Promise<void> {
  const entries = Array.from(hashIndex.values());
  await fs.writeFile(HASH_INDEX_FILE, JSON.stringify(entries, null, 2));
}

// Add entry to hash index
async function addToHashIndex(entry: HashEntry): Promise<void> {
  hashIndex.set(entry.hash, entry);
  await saveHashIndex();
}

// Remove entry from hash index by filename
async function removeFromHashIndex(filename: string): Promise<void> {
  for (const [hash, entry] of hashIndex.entries()) {
    if (entry.filename === filename) {
      hashIndex.delete(hash);
      break;
    }
  }
  await saveHashIndex();
}

// Calculate SHA-256 hash of buffer
function calculateHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

// Check if file is a duplicate
function findDuplicate(hash: string): HashEntry | undefined {
  return hashIndex.get(hash);
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

      // Check for duplicate using content hash
      const contentHash = calculateHash(buffer);
      const existingFile = findDuplicate(contentHash);

      if (existingFile) {
        // File already exists, return the existing URL
        console.log(`Duplicate detected for ${originalname}, returning existing: ${existingFile.url}`);

        // Re-extract metadata for the response (lightweight for images)
        const subdir = existingFile.type === 'image' ? 'images' : 'videos';
        const filePath = path.join(UPLOAD_DIR, subdir, existingFile.filename);

        let metadata: Record<string, unknown> = { type: existingFile.type };
        try {
          if (existingFile.type === 'image') {
            const fileBuffer = await fs.readFile(filePath);
            const imageMetadata = await extractImageMetadata(fileBuffer);
            metadata = { ...imageMetadata, type: 'image' };
          } else {
            const videoMetadata = await extractVideoMetadata(filePath, actualMimeType);
            // Extract thumbnail for duplicate video
            const thumbnailDir = path.join(UPLOAD_DIR, 'thumbnails');
            const thumbnailResult = await extractVideoThumbnail(filePath, thumbnailDir, PUBLIC_URL);
            metadata = {
              ...videoMetadata,
              type: 'video',
              ...(thumbnailResult && {
                thumbnailUrl: thumbnailResult.thumbnailUrl,
                lqip: thumbnailResult.lqip,
              }),
            };
          }
        } catch {
          // If metadata extraction fails, continue with basic info
        }

        return res.json({
          success: true,
          duplicate: true,
          id: path.basename(existingFile.filename, path.extname(existingFile.filename)),
          url: existingFile.url,
          originalFilename: originalname,
          mimeType: actualMimeType,
          size,
          ...metadata,
        });
      }

      // Check disk space before proceeding (videos need extra space for transcoding)
      const spaceMultiplier = isVideo ? 2.5 : 1;
      if (!(await hasEnoughSpace(size * spaceMultiplier))) {
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
      const subdir = isImage ? 'images' : 'videos';

      let metadata: Record<string, unknown> = {};
      let finalFilename: string;
      let finalMimeType: string = actualMimeType;

      if (isImage) {
        // Images: extract metadata from buffer, then save
        const imageMetadata = await extractImageMetadata(buffer);
        metadata = {
          ...imageMetadata,
          type: 'image',
        };
        finalFilename = `${id}${ext}`;
        const filePath = path.join(UPLOAD_DIR, subdir, finalFilename);
        await fs.writeFile(filePath, buffer);
      } else {
        // Videos: save to temp, analyze, transcode if needed
        const tempFilename = `${id}_temp${ext}`;
        const tempPath = path.join(UPLOAD_DIR, 'videos', tempFilename);
        await fs.writeFile(tempPath, buffer);

        try {
          // Analyze codecs to determine if transcoding is needed
          const codecInfo = await analyzeVideoCodecs(tempPath);
          console.log(`Video codec info for ${originalname}:`, codecInfo);

          if (needsTranscoding(codecInfo)) {
            // Transcode to MP4/H.264
            console.log(`Transcoding ${originalname} to MP4/H.264...`);
            finalFilename = `${id}.mp4`;
            const finalPath = path.join(UPLOAD_DIR, 'videos', finalFilename);

            const transcodeResult = await transcodeVideo(tempPath, finalPath);
            console.log(`Transcoding complete: ${transcodeResult.transcoded}`);

            finalMimeType = 'video/mp4';

            // Extract metadata from transcoded file
            const videoMetadata = await extractVideoMetadata(finalPath, finalMimeType);

            // Extract thumbnail
            const thumbnailDir = path.join(UPLOAD_DIR, 'thumbnails');
            const thumbnailResult = await extractVideoThumbnail(finalPath, thumbnailDir, PUBLIC_URL);

            metadata = {
              ...videoMetadata,
              type: 'video',
              transcoded: true,
              originalMimeType: actualMimeType,
              ...(thumbnailResult && {
                thumbnailUrl: thumbnailResult.thumbnailUrl,
                lqip: thumbnailResult.lqip,
              }),
            };
          } else {
            // No transcoding needed, rename temp to final
            console.log(`No transcoding needed for ${originalname}`);
            finalFilename = `${id}${ext}`;
            const finalPath = path.join(UPLOAD_DIR, 'videos', finalFilename);
            await fs.rename(tempPath, finalPath);

            // Extract metadata from final file
            const videoMetadata = await extractVideoMetadata(finalPath, actualMimeType);

            // Extract thumbnail
            const thumbnailDir = path.join(UPLOAD_DIR, 'thumbnails');
            const thumbnailResult = await extractVideoThumbnail(finalPath, thumbnailDir, PUBLIC_URL);

            metadata = {
              ...videoMetadata,
              type: 'video',
              transcoded: false,
              ...(thumbnailResult && {
                thumbnailUrl: thumbnailResult.thumbnailUrl,
                lqip: thumbnailResult.lqip,
              }),
            };
          }
        } catch (transcodeError) {
          // Clean up temp file on error
          await fs.unlink(tempPath).catch(() => {});
          throw transcodeError;
        }
      }

      // Build response
      const url = `${PUBLIC_URL}/files/${subdir}/${finalFilename}`;

      // Add to hash index for future duplicate detection
      await addToHashIndex({
        hash: contentHash,
        filename: finalFilename,
        type: isImage ? 'image' : 'video',
        url,
      });

      res.json({
        success: true,
        id,
        url,
        originalFilename: originalname,
        mimeType: finalMimeType,
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

// Get metadata for a specific file by URL
app.post('/metadata', authenticate, apiLimiter, async (req, res) => {
  try {
    const { url, type } = req.body;

    if (!url || !type) {
      return res.status(400).json({ error: 'Missing url or type parameter' });
    }

    // Extract filename from URL
    const urlPattern = new RegExp(`/files/(images|videos)/([^/]+)$`);
    const match = url.match(urlPattern);

    if (!match) {
      return res.status(400).json({ error: 'Invalid media URL format' });
    }

    const [, subdir, filename] = match;
    const filePath = path.join(UPLOAD_DIR, subdir, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    const stat = await fs.stat(filePath);
    const id = path.basename(filename, path.extname(filename));

    if (type === 'image') {
      const buffer = await fs.readFile(filePath);
      const imageMetadata = await extractImageMetadata(buffer);

      res.json({
        success: true,
        id,
        url,
        filename,
        size: stat.size,
        type: 'image',
        ...imageMetadata,
      });
    } else if (type === 'video') {
      // Detect mime type from file extension
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.webm': 'video/webm',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
      };
      const mimeType = mimeTypes[ext] || 'video/mp4';

      const videoMetadata = await extractVideoMetadata(filePath, mimeType);

      // Extract thumbnail
      const thumbnailDir = path.join(UPLOAD_DIR, 'thumbnails');
      const thumbnailResult = await extractVideoThumbnail(filePath, thumbnailDir, PUBLIC_URL);

      res.json({
        success: true,
        id,
        url,
        filename,
        size: stat.size,
        type: 'video',
        ...videoMetadata,
        mimeType, // Override mimeType from videoMetadata with our detected one
        ...(thumbnailResult && {
          thumbnailUrl: thumbnailResult.thumbnailUrl,
          lqip: thumbnailResult.lqip,
        }),
      });
    } else {
      return res.status(400).json({ error: 'Invalid type parameter' });
    }
  } catch (error) {
    console.error('Metadata error:', error);
    res.status(500).json({ error: 'Failed to extract metadata' });
  }
});

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

      // Remove from hash index
      await removeFromHashIndex(sanitizedFilename);

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

  // Load hash index for duplicate detection
  await loadHashIndex();

  // Check FFmpeg availability for video transcoding
  const ffmpegAvailable = await checkFfmpegAvailable();
  if (!ffmpegAvailable) {
    console.warn('WARNING: FFmpeg not available. Video transcoding will fail.');
  }

  // Clean up any orphaned temp files from previous runs
  await cleanupOrphanedTempFiles(path.join(UPLOAD_DIR, 'videos'));

  server = app.listen(PORT, () => {
    console.log(`Media server running on port ${PORT}`);
    console.log(`Public URL: ${PUBLIC_URL}`);
    console.log(`Upload directory: ${path.resolve(UPLOAD_DIR)}`);
    console.log(`API key required: ${API_KEY ? 'yes' : 'no'}`);
    console.log(`Minimum free space: ${MIN_FREE_SPACE_MB}MB`);
    console.log(`FFmpeg available: ${ffmpegAvailable ? 'yes' : 'no'}`);
  });

  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

start().catch(console.error);
