"use client"

import { useRef } from 'react'
import Image from 'next/image'
import MetadataDialog from "./MetadataDialog";
import Video from "./Video";
import { MediaLightbox } from "./MediaLightbox";
import { cn } from "@/lib/utils";
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

// Row height based on portrait phone video (9:16 aspect ratio)
// This makes 1-col portrait items show properly, and 2-col items match the height
const ROW_HEIGHT = "h-[28rem] lg:h-[32rem]";

export function MediaWrapper({ children, createdAt, metadata, className }: MediaWrapperProps) {
  return (
    <div className={cn(`relative w-full overflow-hidden rounded-lg`, ROW_HEIGHT, className)}>
      {children}
      <div className="absolute bottom-2 left-4 z-10">
        {metadata && metadata.mediaType === 'image' && (
          <MetadataDialog
            media={metadata}
            createdAt={createdAt}
          />
        )}
      </div>
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
    const dateTimeOriginal = media.exif?.dateTime;
    const createdAt = dateTimeOriginal ? new Date(dateTimeOriginal) : undefined;

    const horizontal = isHorizontal(media.aspectRatio || 1);
    const width = media.width || 800;
    const height = media.height || 600;

    // Use provided colSpan or fall back to natural sizing
    const spanClass = colSpan
      ? getSpanClass(colSpan)
      : horizontal ? "lg:col-span-2" : "lg:col-span-1";

    return (
      <MediaWrapper
        createdAt={createdAt}
        metadata={media}
        className={spanClass}
      >
        <MediaLightbox
          type="image"
          src={media.url}
          alt={media.alt || "Image"}
          width={width}
          height={height}
          lqip={media.lqip || undefined}
        >
          <Image
            className="rounded-lg w-full h-full object-cover"
            alt={media.alt || "Image"}
            placeholder={media.lqip ? "blur" : "empty"}
            blurDataURL={media.lqip || undefined}
            src={media.url}
            width={width}
            height={height}
          />
        </MediaLightbox>
      </MediaWrapper>
    );
  }

  // Video
  return <FeedVideo media={media} colSpan={colSpan} />;
}

function FeedVideo({ media, colSpan }: FeedMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const horizontal = media.orientation === 'horizontal';

  // Use provided colSpan or fall back to natural sizing
  const spanClass = colSpan
    ? getSpanClass(colSpan)
    : horizontal ? "lg:col-span-2" : "lg:col-span-1";

  return (
    <div className={cn(
      "relative w-full overflow-hidden rounded-lg",
      ROW_HEIGHT,
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
