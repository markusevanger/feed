#!/usr/bin/env node
/**
 * Generate favicon and app icons from source PNG
 * Usage: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'favicon-feed.png');
const OUTPUT_DIR = path.join(ROOT, 'apps/web/src/app');

// Icon sizes needed
const SIZES = {
  // Favicon sizes (will be combined into .ico)
  favicon: [16, 32, 48],
  // Apple touch icon
  appleIcon: 180,
  // Web manifest icons
  webIcons: [192, 512],
  // Open Graph image
  ogImage: 1200,
};

// Border radius as percentage of image size (for rounded corners)
const BORDER_RADIUS_PERCENT = 20;

// Padding as percentage of final image size
const PADDING_PERCENT = 12;

// Background color (dark, matching the source image)
const BG_COLOR = { r: 10, g: 10, b: 10, alpha: 1 };

/**
 * Create a rounded rectangle mask
 */
async function createRoundedMask(size, radiusPercent) {
  const radius = Math.round(size * radiusPercent / 100);
  const svg = `
    <svg width="${size}" height="${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>
  `;
  return Buffer.from(svg);
}

/**
 * Process image: add padding, resize, and apply rounded corners
 */
async function processIcon(sourceBuffer, size, applyRounding = true) {
  const padding = Math.round(size * PADDING_PERCENT / 100);
  const innerSize = size - (padding * 2);

  // First resize the logo to fit within the padded area
  const resizedLogo = await sharp(sourceBuffer)
    .resize(innerSize, innerSize, {
      fit: 'contain',
      position: 'center',
      background: BG_COLOR,
    })
    .toBuffer();

  // Create the final image with padding
  let image = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG_COLOR,
    }
  })
    .composite([{
      input: resizedLogo,
      top: padding,
      left: padding,
    }]);

  if (applyRounding) {
    // Need to flatten first, then apply mask
    const flattened = await image.png().toBuffer();
    const mask = await createRoundedMask(size, BORDER_RADIUS_PERCENT);
    image = sharp(flattened).composite([{
      input: mask,
      blend: 'dest-in',
    }]);
  }

  return image.png().toBuffer();
}

/**
 * Create ICO file from multiple PNG sizes
 * ICO format: header + directory entries + image data
 */
async function createIco(pngBuffers) {
  // ICO header: 2 bytes reserved (0), 2 bytes type (1 = icon), 2 bytes count
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: 1 = icon
  header.writeUInt16LE(pngBuffers.length, 4); // Number of images

  // Calculate offsets
  const directorySize = 16 * pngBuffers.length;
  let offset = 6 + directorySize;

  const directories = [];
  const images = [];

  for (const { buffer, size } of pngBuffers) {
    // Directory entry: 16 bytes each
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size === 256 ? 0 : size, 0); // Width (0 means 256)
    dir.writeUInt8(size === 256 ? 0 : size, 1); // Height (0 means 256)
    dir.writeUInt8(0, 2); // Color palette (0 = no palette)
    dir.writeUInt8(0, 3); // Reserved
    dir.writeUInt16LE(1, 4); // Color planes
    dir.writeUInt16LE(32, 6); // Bits per pixel
    dir.writeUInt32LE(buffer.length, 8); // Image size
    dir.writeUInt32LE(offset, 12); // Offset to image data

    directories.push(dir);
    images.push(buffer);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...directories, ...images]);
}

async function main() {
  console.log('Reading source image...');
  const sourceBuffer = await fs.readFile(SOURCE);

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Generate favicon.ico (multiple sizes, with rounding)
  console.log('Generating favicon.ico...');
  const faviconPngs = await Promise.all(
    SIZES.favicon.map(async (size) => ({
      size,
      buffer: await processIcon(sourceBuffer, size, true),
    }))
  );
  const icoBuffer = await createIco(faviconPngs);
  await fs.writeFile(path.join(OUTPUT_DIR, 'favicon.ico'), icoBuffer);
  console.log('  Created favicon.ico');

  // Generate apple-icon.png
  console.log('Generating apple-icon.png...');
  const appleIcon = await processIcon(sourceBuffer, SIZES.appleIcon, true);
  await fs.writeFile(path.join(OUTPUT_DIR, 'apple-icon.png'), appleIcon);
  console.log('  Created apple-icon.png (180x180)');

  // Generate web manifest icons
  console.log('Generating web manifest icons...');
  for (const size of SIZES.webIcons) {
    const icon = await processIcon(sourceBuffer, size, true);
    const filename = `icon-${size}.png`;
    await fs.writeFile(path.join(OUTPUT_DIR, filename), icon);
    console.log(`  Created ${filename}`);
  }

  // Generate icon.png (default, 512px)
  const defaultIcon = await processIcon(sourceBuffer, 512, true);
  await fs.writeFile(path.join(OUTPUT_DIR, 'icon.png'), defaultIcon);
  console.log('  Created icon.png (512x512)');

  // Generate opengraph-image.png (larger, for social media)
  console.log('Generating opengraph-image.png...');
  // For OG image, we want a wider format (1200x630 is standard)
  const ogImage = await sharp(sourceBuffer)
    .resize(630, 630, { fit: 'cover', position: 'center' })
    .extend({
      top: 0,
      bottom: 0,
      left: 285,
      right: 285,
      background: { r: 10, g: 10, b: 10, alpha: 1 }, // Match dark background
    })
    .png()
    .toBuffer();
  await fs.writeFile(path.join(OUTPUT_DIR, 'opengraph-image.png'), ogImage);
  console.log('  Created opengraph-image.png (1200x630)');

  console.log('\nAll icons generated successfully!');
  console.log('\nGenerated files in apps/web/src/app/:');
  console.log('  - favicon.ico (16x16, 32x32, 48x48)');
  console.log('  - apple-icon.png (180x180)');
  console.log('  - icon.png (512x512)');
  console.log('  - icon-192.png (192x192)');
  console.log('  - icon-512.png (512x512)');
  console.log('  - opengraph-image.png (1200x630)');
}

main().catch(console.error);
