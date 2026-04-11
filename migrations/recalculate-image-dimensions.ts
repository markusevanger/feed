/**
 * Script to recalculate image dimensions with proper EXIF orientation handling
 *
 * This script:
 * 1. Fetches all posts with selfHostedMedia images
 * 2. Downloads each image from the media server
 * 3. Re-extracts metadata with EXIF rotation applied
 * 4. Updates Sanity with corrected width, height, aspectRatio
 *
 * Usage:
 *   npx tsx migrations/recalculate-image-dimensions.ts
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SANITY_PROJECT_ID
 *   - NEXT_PUBLIC_SANITY_DATASET
 *   - SANITY_API_TOKEN (with write access)
 */

import { createClient } from '@sanity/client';
import sharp from 'sharp';
import * as fs from 'fs';

// Load environment variables from .env.local manually
function loadEnvFile(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  } catch {
    // File doesn't exist, skip
  }
}

// Try loading from multiple locations
loadEnvFile('.env.local');
loadEnvFile('apps/web/.env.local');
loadEnvFile('../web/.env.local'); // When running from apps/media-server

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_TOKEN;

if (!projectId || !dataset) {
  console.error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID or NEXT_PUBLIC_SANITY_DATASET');
  process.exit(1);
}

if (!token) {
  console.error('Missing SANITY_API_TOKEN - need write access to update documents');
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: '2025-03-03',
  useCdn: false,
});

interface MediaItem {
  _key: string;
  mediaType: 'image' | 'video';
  url: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  lqip?: string;
  // Keep other fields
  alt?: string;
  exif?: Record<string, unknown>;
  location?: { lat: number; lon: number };
  mimeType?: string;
  orientation?: string;
  thumbnailUrl?: string;
}

interface Post {
  _id: string;
  title: string;
  media?: MediaItem[];
}

async function extractImageMetadata(buffer: Buffer) {
  // First, apply EXIF rotation and convert to buffer to get actual rotated dimensions
  const rotatedBuffer = await sharp(buffer).rotate().toBuffer();

  // Now get metadata from the rotated image
  const rotatedImage = sharp(rotatedBuffer);
  const metadata = await rotatedImage.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Could not determine image dimensions');
  }

  // Generate LQIP (Low Quality Image Placeholder)
  const lqipBuffer = await rotatedImage
    .resize(20, 20, { fit: 'inside' })
    .jpeg({ quality: 50 })
    .blur(2)
    .toBuffer();

  const lqip = `data:image/jpeg;base64,${lqipBuffer.toString('base64')}`;

  return {
    width: metadata.width,
    height: metadata.height,
    aspectRatio: Number((metadata.width / metadata.height).toFixed(4)),
    lqip,
  };
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function processPost(post: Post): Promise<boolean> {
  if (!post.media || post.media.length === 0) {
    return false;
  }

  const images = post.media.filter((m) => m.mediaType === 'image');
  if (images.length === 0) {
    return false;
  }

  console.log(`\nProcessing: ${post.title} (${post._id})`);
  console.log(`  Found ${images.length} image(s)`);

  let hasChanges = false;
  const updatedMedia = [...post.media];

  for (let i = 0; i < updatedMedia.length; i++) {
    const item = updatedMedia[i];
    if (item.mediaType !== 'image' || !item.url) {
      continue;
    }

    try {
      console.log(`  Processing: ${item.url}`);

      const buffer = await downloadImage(item.url);
      const metadata = await extractImageMetadata(buffer);

      const oldAspect = item.aspectRatio || 0;
      const newAspect = metadata.aspectRatio;

      // Check if dimensions changed significantly
      const aspectChanged = Math.abs(oldAspect - newAspect) > 0.01;
      const orientationFlipped =
        (oldAspect > 1 && newAspect <= 1) || (oldAspect <= 1 && newAspect > 1);

      if (orientationFlipped) {
        console.log(
          `    ⚠ Orientation flipped: ${oldAspect.toFixed(2)} → ${newAspect.toFixed(2)}`
        );
        console.log(
          `      ${item.width}x${item.height} → ${metadata.width}x${metadata.height}`
        );
      } else if (aspectChanged) {
        console.log(
          `    ~ Aspect changed: ${oldAspect.toFixed(2)} → ${newAspect.toFixed(2)}`
        );
      } else {
        console.log(`    ✓ No change needed`);
        continue;
      }

      // Update the media item
      updatedMedia[i] = {
        ...item,
        width: metadata.width,
        height: metadata.height,
        aspectRatio: metadata.aspectRatio,
        lqip: metadata.lqip,
      };
      hasChanges = true;
    } catch (error) {
      console.error(`    ✗ Failed to process:`, error);
    }
  }

  if (hasChanges) {
    console.log(`  Updating document...`);
    await client.patch(post._id).set({ media: updatedMedia }).commit();
    console.log(`  ✓ Document updated`);
  }

  return hasChanges;
}

async function main() {
  console.log('Recalculating image dimensions with EXIF orientation...');
  console.log(`Project: ${projectId}`);
  console.log(`Dataset: ${dataset}`);

  // Fetch all posts with media
  const query = `*[_type == "post" && defined(media)] {
    _id,
    title,
    media
  }`;

  const posts: Post[] = await client.fetch(query);
  console.log(`\nFound ${posts.length} posts with media`);

  let updatedCount = 0;

  for (const post of posts) {
    const wasUpdated = await processPost(post);
    if (wasUpdated) {
      updatedCount++;
    }
  }

  console.log(`\n✓ Complete! Updated ${updatedCount} post(s)`);
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
