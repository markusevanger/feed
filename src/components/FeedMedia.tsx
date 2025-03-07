import { urlFor } from "@/sanity/lib/image";
import { POST_QUERYResult } from "../../sanity.types";
import Image from 'next/image'
import MetadataDialog from "./MetadataDialog";
import Video from "./Video";

/** Interface only because sanity typegen stupid */
export interface ExifMetadata {
  dateTime?: string;
  lensMake?: string;
  lensModel?: string;
}

// Gets subtype from POST_QUERYResult
type ElementType<T> = T extends Array<infer U> ? U : never;
export type ImageType = ElementType<NonNullable<POST_QUERYResult[number]["images"]>>;
export type VideoType = ElementType<NonNullable<POST_QUERYResult[number]["videos"]>>;
export type AssetType = ElementType<NonNullable<POST_QUERYResult[number]["images"]>>["asset"];
export type MetadataType = NonNullable<ElementType<NonNullable<POST_QUERYResult[number]["images"]>>["asset"]>["metadata"];


type MediaType = { type: 'image'; data: ImageType } | { type: 'video'; data: VideoType };

interface MediaWrapperProps {
  children: React.ReactNode;
  createdAt?: Date;
  assetId?: string;
  metadata?: MetadataType;
  altText?: string | null;
  className?: string;
}


//const isVertical = (aspectRatio: number) => aspectRatio < 1;
const isHorizontal = (aspectRatio: number) => aspectRatio > 1;




export function MediaWrapper({ children, createdAt, assetId, metadata, altText, className }: MediaWrapperProps) {
  return (
    <div key={assetId} className={`relative ${className} w-full h-full max-h-140 overflow-hidden`}>
      {children}
      <div className="absolute bottom-2 left-4">
        {metadata && (
          <MetadataDialog
            imageAsset={{
              _id: assetId || '',
              url: null,
              _createdAt: createdAt?.toISOString() || "",
              altText: altText || null,
              metadata
            }}
          />
        )}
      </div>
    </div >
  );
}

export default function FeedMedia({ media }: { media: MediaType }) {
  if (media.type === 'image') {
    const image = media.data;
    const exif = image.asset?.metadata?.exif as unknown as ExifMetadata;
    const dateTimeOriginal = exif?.dateTime ?? undefined;
    const createdAt = dateTimeOriginal ? new Date(dateTimeOriginal) : undefined;

    const horizontal = isHorizontal(image.asset?.metadata?.dimensions?.aspectRatio || 0);
    const { width, height } = image.asset?.metadata?.dimensions || { width: 1080, height: 1920 };

    return (
      <MediaWrapper
        createdAt={createdAt}
        assetId={image.asset?._id}
        metadata={image.asset?.metadata}
        altText={image.asset?.altText}
        className={horizontal ? "col-span-2" : ""}
      >
        <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-muted rounded-full px-2 py-1">x: {width} y: {height}</div>
        <Image
          className="rounded-lg w-full h-full object-cover"
          alt={image.asset?.altText || "Image"}
          placeholder="blur"
          blurDataURL={image.asset?.metadata?.lqip || ''}
          src={urlFor(image).url()}
          width={width}
          height={height}
        />
      </MediaWrapper>
    );
  }

  return <Video video={media.data} className={""} />;
}
