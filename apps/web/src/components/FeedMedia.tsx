import Image from 'next/image'
import MetadataDialog from "./MetadataDialog";
import Video from "./Video";
import { cn } from "@/lib/utils";
import type { SelfHostedImage, SelfHostedVideo } from "../../sanity.types";

// Re-export types for use in other components
export type { SelfHostedImage, SelfHostedVideo };

type MediaType = { type: 'image'; data: SelfHostedImage } | { type: 'video'; data: SelfHostedVideo };

interface MediaWrapperProps {
  children: React.ReactNode;
  createdAt?: Date;
  metadata?: SelfHostedImage;
  className?: string;
}

const isHorizontal = (aspectRatio: number) => aspectRatio > 1;

export function MediaWrapper({ children, createdAt, metadata, className }: MediaWrapperProps) {
  return (
    <div className={cn(`relative w-full h-full max-h-140 overflow-hidden`, className)}>
      {children}
      <div className="absolute bottom-2 left-4">
        {metadata && (
          <MetadataDialog
            image={metadata}
            createdAt={createdAt}
          />
        )}
      </div>
    </div >
  );
}

export default function FeedMedia({ media }: { media: MediaType }) {
  if (media.type === 'image') {
    const image = media.data;
    const dateTimeOriginal = image.exif?.dateTime;
    const createdAt = dateTimeOriginal ? new Date(dateTimeOriginal) : undefined;

    const horizontal = isHorizontal(image.aspectRatio || 1);
    const width = image.width || 800;
    const height = image.height || 600;

    return (
      <MediaWrapper
        createdAt={createdAt}
        metadata={image}
        className={horizontal ? "lg:col-span-2" : "lg:col-span-1"}
      >
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-muted rounded-full px-2 py-1">
          {width} x {height}
        </div>
        <Image
          className="rounded-lg w-full h-full object-cover"
          alt={image.alt || "Image"}
          placeholder={image.lqip ? "blur" : "empty"}
          blurDataURL={image.lqip || undefined}
          src={image.url}
          width={width}
          height={height}
        />
      </MediaWrapper>
    );
  }

  return <Video video={media.data} className={""} />;
}
