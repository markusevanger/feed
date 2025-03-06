import { urlFor } from "@/sanity/lib/image";
import { POST_QUERYResult } from "../../sanity.types";
import Image from 'next/image'
import { Badge } from "./ui/badge";
import MetadataDialog from "./MetadataDialog";

export interface ExifMetadata {
  DateTimeOriginal?: string;
  LensMake?: string;
  LensModel?: string;
}

// Gets subtype from POST_QUERYResult
type ElementType<T> = T extends Array<infer U> ? U : never;
type ImageType = ElementType<NonNullable<POST_QUERYResult[number]["images"]>>;

export default function FeedImage({ image }: { image: ImageType }) {
  const exif = image.asset?.metadata?.exif as ExifMetadata | undefined;
  const dateTimeOriginal = exif?.DateTimeOriginal;
  const createdAt = dateTimeOriginal ? new Date(dateTimeOriginal) : undefined;

  return (
    <div
      key={image.asset?._id}
      className={""}
    >
      <div className="absolute top-0 right-0">
        {
          image.asset && image.asset.metadata &&
          <MetadataDialog imageAsset={image.asset} />
        }
      </div>
      <Image className="rounded-lg shadow-xl w-ful h-fulll" alt={"asd"} placeholder="blur" blurDataURL={image.asset?.metadata?.lqip!!} src={urlFor(image).url()} width={300} height={300}></Image>
      <div className="justify-between w-full flex mt-1">

        {
          createdAt &&
          <Badge variant={"outline"} className="font-mono">{createdAt.toLocaleDateString("no")} at {createdAt.toLocaleTimeString('no')}</Badge>
        } 

        {
          image.asset && image.asset.metadata &&
          <MetadataDialog imageAsset={image.asset} />
        }
      </div>
    </div>
  )


}
