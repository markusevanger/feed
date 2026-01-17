import sharp from 'sharp';
import exifReader from 'exif-reader';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ImageMetadata, VideoMetadata } from '@feed/shared';

const execAsync = promisify(exec);

// Re-export types for backwards compatibility
export type { ImageMetadata, VideoMetadata } from '@feed/shared';

// Parse EXIF date format (YYYY:MM:DD HH:MM:SS) to ISO
function parseExifDate(exifDate: string | Date | undefined): string | undefined {
  if (!exifDate) return undefined;

  // If it's already a Date object
  if (exifDate instanceof Date) {
    return exifDate.toISOString();
  }

  try {
    // EXIF format: "2024:01:15 14:30:00"
    const [datePart, timePart] = exifDate.split(' ');
    if (!datePart) return undefined;
    const isoDate = datePart.replace(/:/g, '-');
    return timePart ? `${isoDate}T${timePart}` : isoDate;
  } catch {
    return undefined;
  }
}

// Convert GPS coordinates from EXIF format to decimal degrees
function parseGpsCoordinate(
  ref: string | undefined,
  coord: number[] | undefined
): number | undefined {
  if (!ref || !coord || coord.length < 3) return undefined;

  const [degrees, minutes, seconds] = coord;
  let decimal = degrees + minutes / 60 + seconds / 3600;

  if (ref === 'S' || ref === 'W') {
    decimal = -decimal;
  }

  return decimal;
}

// Format exposure time as a fraction string
function formatExposureTime(exposure: number | undefined): string | undefined {
  if (!exposure) return undefined;
  if (exposure >= 1) return `${exposure}s`;
  return `1/${Math.round(1 / exposure)}`;
}

export async function extractImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Could not determine image dimensions');
  }

  // Generate LQIP (Low Quality Image Placeholder)
  const lqipBuffer = await image
    .resize(20, 20, { fit: 'inside' })
    .jpeg({ quality: 50 })
    .blur(2)
    .toBuffer();

  const lqip = `data:image/jpeg;base64,${lqipBuffer.toString('base64')}`;

  const result: ImageMetadata = {
    width: metadata.width,
    height: metadata.height,
    aspectRatio: Number((metadata.width / metadata.height).toFixed(4)),
    lqip,
  };

  // Extract EXIF data if available
  if (metadata.exif) {
    try {
      const exif = exifReader(metadata.exif);

      result.exif = {};

      // Date/time
      if (exif.Photo?.DateTimeOriginal || exif.Image?.DateTime) {
        result.exif.dateTime = parseExifDate(
          exif.Photo?.DateTimeOriginal || exif.Image?.DateTime
        );
      }

      // Camera info
      if (exif.Image?.Make) {
        result.exif.cameraMake = String(exif.Image.Make).trim();
      }
      if (exif.Image?.Model) {
        result.exif.cameraModel = String(exif.Image.Model).trim();
      }

      // Lens info
      if (exif.Photo?.LensMake) {
        result.exif.lensMake = String(exif.Photo.LensMake).trim();
      }
      if (exif.Photo?.LensModel) {
        result.exif.lensModel = String(exif.Photo.LensModel).trim();
      }

      // Shooting settings
      if (exif.Photo?.FocalLength) {
        result.exif.focalLength = exif.Photo.FocalLength;
      }
      if (exif.Photo?.FNumber) {
        result.exif.aperture = exif.Photo.FNumber;
      }
      if (exif.Photo?.ISOSpeedRatings) {
        result.exif.iso = Array.isArray(exif.Photo.ISOSpeedRatings)
          ? exif.Photo.ISOSpeedRatings[0]
          : exif.Photo.ISOSpeedRatings;
      }
      if (exif.Photo?.ExposureTime) {
        result.exif.exposureTime = formatExposureTime(exif.Photo.ExposureTime);
      }

      // Clean up empty exif object
      if (Object.keys(result.exif).length === 0) {
        delete result.exif;
      }

      // GPS location
      if (exif.GPSInfo) {
        const lat = parseGpsCoordinate(
          exif.GPSInfo.GPSLatitudeRef,
          exif.GPSInfo.GPSLatitude as number[] | undefined
        );
        const lon = parseGpsCoordinate(
          exif.GPSInfo.GPSLongitudeRef,
          exif.GPSInfo.GPSLongitude as number[] | undefined
        );

        if (lat !== undefined && lon !== undefined) {
          result.location = { lat, lon };

          if (exif.GPSInfo.GPSAltitude !== undefined) {
            result.location.alt = exif.GPSInfo.GPSAltitude as number;
          }
        }
      }
    } catch (e) {
      // EXIF parsing failed, continue without it
      console.warn('EXIF parsing failed:', e);
    }
  }

  return result;
}

export async function extractVideoMetadata(
  filePath: string,
  mimeType: string
): Promise<VideoMetadata> {
  const result: VideoMetadata = {
    mimeType,
  };

  try {
    // Use ffprobe to extract video metadata
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
    );

    const probe = JSON.parse(stdout);
    const videoStream = probe.streams?.find(
      (s: { codec_type: string }) => s.codec_type === 'video'
    );

    if (videoStream) {
      result.width = videoStream.width;
      result.height = videoStream.height;
      result.codec = videoStream.codec_name;

      // Parse frame rate (usually in format "30/1" or "30000/1001")
      if (videoStream.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
        if (num && den) {
          result.frameRate = Math.round((num / den) * 100) / 100;
        }
      }

      // Determine orientation
      if (result.width && result.height) {
        result.orientation = result.width >= result.height ? 'horizontal' : 'vertical';
      }
    }

    // Get duration from format
    if (probe.format?.duration) {
      result.duration = parseFloat(probe.format.duration);
    }
  } catch (e) {
    // ffprobe not available or failed, return basic metadata
    console.warn('ffprobe failed, returning basic video metadata:', e);
  }

  return result;
}
