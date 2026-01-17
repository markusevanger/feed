/**
 * Migration script to convert Sanity native assets to self-hosted media
 *
 * This script:
 * 1. Fetches all posts with native image/video assets
 * 2. Downloads each asset from Sanity CDN
 * 3. Re-uploads to the self-hosted media server
 * 4. Updates the document with the new selfHostedImage/selfHostedVideo format
 *
 * Usage:
 *   npx tsx migrations/migrate-to-self-hosted.ts
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SANITY_PROJECT_ID
 *   - NEXT_PUBLIC_SANITY_DATASET
 *   - SANITY_API_TOKEN (with write access)
 *   - MEDIA_SERVER_URL
 *   - MEDIA_API_KEY (optional)
 */

import { createClient } from '@sanity/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_TOKEN;
const mediaServerUrl = process.env.MEDIA_SERVER_URL;
const mediaApiKey = process.env.MEDIA_API_KEY;

if (!projectId || !dataset) {
  console.error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID or NEXT_PUBLIC_SANITY_DATASET');
  process.exit(1);
}

if (!token) {
  console.error('Missing SANITY_API_TOKEN - need write access to update documents');
  process.exit(1);
}

if (!mediaServerUrl) {
  console.error('Missing MEDIA_SERVER_URL');
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: '2025-03-03',
  useCdn: false,
});

interface SanityImageAsset {
  _id: string;
  url: string;
  originalFilename?: string;
  metadata?: {
    dimensions?: {
      width: number;
      height: number;
      aspectRatio: number;
    };
    lqip?: string;
    exif?: Record<string, unknown>;
    location?: {
      lat: number;
      lng: number;
    };
  };
}

interface SanityFileAsset {
  _id: string;
  url: string;
  originalFilename?: string;
  mimeType?: string;
}

interface OldImage {
  _key: string;
  _type: 'image';
  asset: { _ref: string };
}

interface OldVideo {
  _key: string;
  _type: 'file';
  asset: { _ref: string };
  orientation?: 'horizontal' | 'vertical';
}

interface Post {
  _id: string;
  title: string;
  images?: (OldImage | { _type: 'selfHostedImage' })[];
  videos?: (OldVideo | { _type: 'selfHostedVideo' })[];
}

async function fetchAsset(assetRef: string): Promise<SanityImageAsset | SanityFileAsset | null> {
  try {
    const assetId = assetRef.replace('image-', '').replace('file-', '');
    const isImage = assetRef.startsWith('image-');

    const query = `*[_id == $id][0]`;
    const asset = await client.fetch(query, { id: assetRef });

    if (!asset) {
      console.warn(`Asset not found: ${assetRef}`);
      return null;
    }

    return asset;
  } catch (error) {
    console.error(`Failed to fetch asset ${assetRef}:`, error);
    return null;
  }
}

async function downloadFile(url: string): Promise<Buffer> {
  console.log(`  Downloading: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadToMediaServer(buffer: Buffer, filename: string, mimeType: string) {
  console.log(`  Uploading to media server: ${filename}`);

  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  formData.append('file', blob, filename);

  const headers: HeadersInit = {};
  if (mediaApiKey) {
    headers['Authorization'] = `Bearer ${mediaApiKey}`;
  }

  const response = await fetch(`${mediaServerUrl}/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${error}`);
  }

  return response.json();
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

async function migratePost(post: Post) {
  console.log(`\nMigrating post: ${post.title} (${post._id})`);

  const newImages: Array<Record<string, unknown>> = [];
  const newVideos: Array<Record<string, unknown>> = [];

  // Migrate images
  if (post.images) {
    for (const image of post.images) {
      // Skip already migrated images
      if (image._type === 'selfHostedImage') {
        console.log(`  Skipping already migrated image`);
        newImages.push(image as Record<string, unknown>);
        continue;
      }

      const oldImage = image as OldImage;
      console.log(`  Processing image: ${oldImage.asset._ref}`);

      const asset = await fetchAsset(oldImage.asset._ref) as SanityImageAsset;
      if (!asset?.url) {
        console.warn(`  Skipping image - no URL found`);
        continue;
      }

      try {
        const buffer = await downloadFile(asset.url);
        const filename = asset.originalFilename || `image-${oldImage._key}.jpg`;
        const mimeType = getMimeType(filename);

        const uploadResult = await uploadToMediaServer(buffer, filename, mimeType);

        newImages.push({
          _type: 'selfHostedImage',
          _key: oldImage._key,
          url: uploadResult.url,
          width: uploadResult.width || asset.metadata?.dimensions?.width || 0,
          height: uploadResult.height || asset.metadata?.dimensions?.height || 0,
          aspectRatio: uploadResult.aspectRatio || asset.metadata?.dimensions?.aspectRatio || 1,
          lqip: uploadResult.lqip || asset.metadata?.lqip,
          exif: uploadResult.exif,
          location: uploadResult.location,
        });

        console.log(`  ✓ Migrated image to: ${uploadResult.url}`);
      } catch (error) {
        console.error(`  ✗ Failed to migrate image:`, error);
      }
    }
  }

  // Migrate videos
  if (post.videos) {
    for (const video of post.videos) {
      // Skip already migrated videos
      if (video._type === 'selfHostedVideo') {
        console.log(`  Skipping already migrated video`);
        newVideos.push(video as Record<string, unknown>);
        continue;
      }

      const oldVideo = video as OldVideo;
      if (!oldVideo.asset?._ref) {
        console.warn(`  Skipping video - no asset reference`);
        continue;
      }

      console.log(`  Processing video: ${oldVideo.asset._ref}`);

      const asset = await fetchAsset(oldVideo.asset._ref) as SanityFileAsset;
      if (!asset?.url) {
        console.warn(`  Skipping video - no URL found`);
        continue;
      }

      try {
        const buffer = await downloadFile(asset.url);
        const filename = asset.originalFilename || `video-${oldVideo._key}.mp4`;
        const mimeType = asset.mimeType || getMimeType(filename);

        const uploadResult = await uploadToMediaServer(buffer, filename, mimeType);

        newVideos.push({
          _type: 'selfHostedVideo',
          _key: oldVideo._key,
          url: uploadResult.url,
          mimeType: uploadResult.mimeType || mimeType,
          orientation: oldVideo.orientation || 'horizontal',
        });

        console.log(`  ✓ Migrated video to: ${uploadResult.url}`);
      } catch (error) {
        console.error(`  ✗ Failed to migrate video:`, error);
      }
    }
  }

  // Update the document
  if (newImages.length > 0 || newVideos.length > 0) {
    console.log(`  Updating document...`);

    const patch: Record<string, unknown> = {};
    if (newImages.length > 0) {
      patch.images = newImages;
    }
    if (newVideos.length > 0) {
      patch.videos = newVideos;
    }

    await client
      .patch(post._id)
      .set(patch)
      .commit();

    console.log(`  ✓ Document updated`);
  }
}

async function main() {
  console.log('Starting migration to self-hosted media...');
  console.log(`Project: ${projectId}`);
  console.log(`Dataset: ${dataset}`);
  console.log(`Media Server: ${mediaServerUrl}`);

  // Fetch all posts with native assets
  const query = `*[_type == "post" && (
    count(images[_type == "image"]) > 0 ||
    count(videos[_type == "file"]) > 0
  )] {
    _id,
    title,
    images,
    videos
  }`;

  const posts: Post[] = await client.fetch(query);
  console.log(`\nFound ${posts.length} posts to migrate`);

  for (const post of posts) {
    await migratePost(post);
  }

  console.log('\n✓ Migration complete!');
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
