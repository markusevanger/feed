/**
 * Shared types for media handling across the monorepo
 */

// Location data extracted from EXIF GPS info
export interface GeoLocation {
  lat: number;
  lon: number;
  alt?: number;
}

// EXIF metadata extracted from images
export interface ExifData {
  dateTime?: string;
  lensMake?: string;
  lensModel?: string;
  cameraMake?: string;
  cameraModel?: string;
  focalLength?: number;
  aperture?: number;
  iso?: number;
  exposureTime?: string;
}

// Image metadata returned from the media server
export interface ImageMetadata {
  width: number;
  height: number;
  aspectRatio: number;
  lqip: string;
  exif?: ExifData;
  location?: GeoLocation;
}

// Video metadata returned from the media server
export interface VideoMetadata {
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  orientation?: 'horizontal' | 'vertical';
  codec?: string;
  frameRate?: number;
  // Thumbnail and placeholder
  thumbnailUrl?: string;
  lqip?: string;
  // Transcoding info
  transcoded?: boolean;
  originalMimeType?: string;
}

// Response from media server upload endpoint
export interface UploadResponse {
  success: boolean;
  id: string;
  url: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  type: 'image' | 'video';
  // Image-specific
  width?: number;
  height?: number;
  aspectRatio?: number;
  lqip?: string;
  exif?: ExifData;
  location?: GeoLocation;
  // Video-specific
  duration?: number;
  orientation?: 'horizontal' | 'vertical';
  thumbnailUrl?: string;
  // Transcoding info
  transcoded?: boolean;
  originalMimeType?: string;
}

// Sanity document types for self-hosted media
export interface SelfHostedImage {
  _type: 'selfHostedImage';
  _key?: string;
  url: string;
  width: number;
  height: number;
  aspectRatio: number;
  lqip?: string;
  alt?: string;
  exif?: {
    dateTime?: string;
    lensMake?: string;
    lensModel?: string;
  };
  location?: {
    lat: number;
    lon: number;
  };
}

export interface SelfHostedVideo {
  _type: 'selfHostedVideo';
  _key?: string;
  url: string;
  mimeType: string;
  orientation: 'horizontal' | 'vertical';
  thumbnailUrl?: string;
  lqip?: string;
}

// Unified media type that can be either image or video
export interface SelfHostedMedia {
  _type: 'selfHostedMedia';
  _key?: string;
  mediaType: 'image' | 'video';
  url: string;
  // Image-specific fields
  width?: number;
  height?: number;
  aspectRatio?: number;
  lqip?: string;
  alt?: string;
  exif?: {
    dateTime?: string;
    lensMake?: string;
    lensModel?: string;
  };
  location?: {
    lat: number;
    lon: number;
  };
  // Video-specific fields
  mimeType?: string;
  orientation?: 'horizontal' | 'vertical';
  thumbnailUrl?: string;
}

// Media browser types
export interface MediaFile {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  type: 'image' | 'video';
  createdAt: string;
  metadata?: ImageMetadata | VideoMetadata;
}

export interface MediaStats {
  totalFiles: number;
  totalSize: number;
  imageCount: number;
  videoCount: number;
}
