import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogTrigger } from "./ui/dialog";
import { InfoIcon } from "lucide-react";
import { POST_QUERYResult } from "../../sanity.types";


// Gets subtype from POST_QUERYResult
type ElementType<T> = T extends Array<infer U> ? U : never;
type AssetType = ElementType<NonNullable<POST_QUERYResult[number]["images"]>>["asset"];

export default function MetadataDialog(props: { imageAsset: AssetType }) {

    const { imageAsset } = props

    if (!imageAsset || !imageAsset.metadata) {
        return
    }

    const meta = imageAsset.metadata
    const createdAt = new Date(imageAsset._createdAt);

    return <Dialog>
        <DialogTrigger><InfoIcon size={12} className="cursor-pointer" /></DialogTrigger>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Metadata</DialogTitle>
            </DialogHeader>
            <DialogDescription>
                <li>shot on:  {createdAt.toLocaleDateString("no")} at {createdAt.toLocaleTimeString('no')}</li>
                <li>location: {meta.location?.lng}, {meta.location?.lat}</li>
                <li>{meta.exif && `camera: ${meta.exif.LensMake} ${meta.exif.LensModel}`}</li>
            </DialogDescription>
        </DialogContent>
    </Dialog>
}