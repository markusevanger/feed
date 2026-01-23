"use client"

import { useRef, useState } from 'react'
import Image from 'next/image'
import MetadataDialog from "./MetadataDialog";
import Video from "./Video";
import { MediaLightbox } from "./MediaLightbox";
import { cn } from "@/lib/utils";
import { useMediaVisibility } from "@/hooks/useMediaVisibility";
import type { SelfHostedMedia } from "../../sanity.types";

// Re-export types for use in other components
export type { SelfHostedMedia };

interface MediaWrapperProps {
  children: React.ReactNode;
  createdAt?: Date;
  metadata?: SelfHostedMedia;
  className?: string;
}

const isHorizontal = (aspectRatio: number) => aspectRatio > 1;

// Helper for Tailwind static analysis - explicit classes required
const getSpanClass = (span: number) => {
  switch (span) {
    case 1: return "lg:col-span-1";
    case 2: return "lg:col-span-2";
    case 3: return "lg:col-span-3";
    default: return "lg:col-span-1";
  }
};

// Desktop: Fixed row height for grid alignment
// Mobile: Use aspect ratio for natural sizing
const ROW_HEIGHT_DESKTOP = "lg:h-[32rem]";

export function MediaWrapper({ children, createdAt, metadata, className, aspectRatio }: MediaWrapperProps & { aspectRatio?: number }) {
  // Mobile: use aspect ratio for natural height, Desktop: fixed height for grid
  const mobileAspectClass = aspectRatio
    ? aspectRatio > 1
      ? "aspect-video" // horizontal: 16:9
      : "aspect-[3/4]" // vertical: 3:4 (shorter than 9:16 to avoid too tall)
    : "aspect-video";

  return (
    <div className={cn(`relative w-full overflow-hidden rounded-lg`, mobileAspectClass, ROW_HEIGHT_DESKTOP, className)}>
      {children}
      {metadata && metadata.mediaType === 'image' && (
        <MetadataDialog
          media={metadata}
          createdAt={createdAt}
        />
      )}
    </div>
  );
}

interface FeedMediaProps {
  media: SelfHostedMedia;
  /** Override the column span (used by grid layout algorithm) */
  colSpan?: 1 | 2 | 3;
}

export default function FeedMedia({ media, colSpan }: FeedMediaProps) {
  // Skip if no URL (media not yet uploaded)
  if (!media.url) return null;

  if (media.mediaType === 'image') {
    return <FeedImage media={media} colSpan={colSpan} />;
  }

  // Video
  return <FeedVideo media={media} colSpan={colSpan} />;
}

function FeedImage({ media, colSpan }: FeedMediaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldLoad, shouldDeload } = useMediaVisibility(containerRef);
  const [imageLoaded, setImageLoaded] = useState(false);

  const dateTimeOriginal = media.exif?.dateTime;
  const createdAt = dateTimeOriginal ? new Date(dateTimeOriginal) : undefined;

  const horizontal = isHorizontal(media.aspectRatio || 1);
  const width = media.width || 800;
  const height = media.height || 600;

  // Use provided colSpan or fall back to natural sizing
  const spanClass = colSpan
    ? getSpanClass(colSpan)
    : horizontal ? "lg:col-span-2" : "lg:col-span-1";

  // Show image if should load OR if loaded and not yet should deload
  const showImage = shouldLoad || (imageLoaded && !shouldDeload);

  return (
    <MediaWrapper
      createdAt={createdAt}
      metadata={media}
      className={spanClass}
      aspectRatio={media.aspectRatio || 1}
    >
      <div ref={containerRef} className="relative w-full h-full">
        {/* LQIP placeholder - always visible as background */}
        {/* Uses GPU-accelerated blur via CSS class for better scroll perf */}
        {media.lqip && (
          <div
            className="absolute inset-0 z-0 rounded-lg lqip-blur"
            style={{
              backgroundImage: `url(${media.lqip})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}

        {/* Image - conditionally rendered based on visibility */}
        {showImage && (
          <MediaLightbox
            type="image"
            src={media.url!}
            alt={media.alt || "Image"}
            width={width}
            height={height}
            lqip={media.lqip || undefined}
          >
            <Image
              className={cn(
                "relative z-10 rounded-lg w-full h-full object-cover transition-opacity duration-300",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
              alt={media.alt || "Image"}
              src={media.url!}
              width={width}
              height={height}
              loading="eager" // We control lazy loading via IntersectionObserver
              onLoad={() => setImageLoaded(true)}
            />
          </MediaLightbox>
        )}

        {/* Show LQIP in lightbox trigger area when image is deloaded */}
        {!showImage && (
          <MediaLightbox
            type="image"
            src={media.url!}
            alt={media.alt || "Image"}
            width={width}
            height={height}
            lqip={media.lqip || undefined}
          >
            <div className="relative z-10 w-full h-full" />
          </MediaLightbox>
        )}
      </div>
    </MediaWrapper>
  );
}

function FeedVideo({ media, colSpan }: FeedMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const horizontal = media.orientation === 'horizontal';

  // Use provided colSpan or fall back to natural sizing
  const spanClass = colSpan
    ? getSpanClass(colSpan)
    : horizontal ? "lg:col-span-2" : "lg:col-span-1";

  // Mobile: use aspect ratio for natural height
  const mobileAspectClass = horizontal ? "aspect-video" : "aspect-[3/4]";

  return (
    <div className={cn(
      "relative w-full overflow-hidden rounded-lg",
      mobileAspectClass,
      ROW_HEIGHT_DESKTOP,
      spanClass,
    )}>
      <MediaLightbox
        type="video"
        src={media.url!}
        mimeType={media.mimeType || undefined}
        videoRef={videoRef}
      >
        <Video video={media} videoRef={videoRef} showControls={false} />
      </MediaLightbox>
    </div>
  );
}
