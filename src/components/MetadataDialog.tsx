import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogTrigger } from "./ui/dialog";
import { InfoIcon } from "lucide-react";
import { POST_QUERYResult } from "../../sanity.types";
import { ExifMetadata } from "./FeedImage";


// Gets subtype from POST_QUERYResult
type ElementType<T> = T extends Array<infer U> ? U : never;
type AssetType = ElementType<NonNullable<POST_QUERYResult[number]["images"]>>["asset"];

export default function MetadataDialog(props: { imageAsset: AssetType }) {

    const { imageAsset } = props

    if (!imageAsset || !imageAsset.metadata) {
        return
    }

    const meta = imageAsset.metadata
    const exif = imageAsset.metadata?.exif as unknown as ExifMetadata | undefined;

    const dateTimeOriginal = exif?.DateTimeOriginal;
    const createdAt = dateTimeOriginal ? new Date(dateTimeOriginal) : new Date(imageAsset._createdAt);


    return <Dialog>
        <DialogTrigger><InfoIcon size={12} className="cursor-pointer" /></DialogTrigger>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Metadata</DialogTitle>
            </DialogHeader>
            <DialogDescription>
                <li>created:  {createdAt.toLocaleDateString("no")} at {createdAt.toLocaleTimeString('no')}</li>
                <li>location: {meta.location?.lng}, {meta.location?.lat}</li>
                <li>{exif && `camera: ${exif.LensMake} ${exif.LensModel}`}</li>
            </DialogDescription>
        </DialogContent>
    </Dialog>
}