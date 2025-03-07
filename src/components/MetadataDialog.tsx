import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogTrigger, DialogFooter } from "./ui/dialog";
import { Camera, Clock, InfoIcon, MapPin } from "lucide-react";
import { AssetType, ExifMetadata } from "./FeedMedia";
import { Badge } from "./ui/badge";


export default function MetadataDialog(props: { imageAsset: AssetType }) {

    const { imageAsset } = props

    if (!imageAsset || !imageAsset.metadata) {
        return
    }

    const meta = imageAsset.metadata
    const exif = imageAsset.metadata?.exif as unknown as ExifMetadata | undefined;

    const dateTimeOriginal = exif?.dateTime ?? undefined;
    const createdAt = dateTimeOriginal ? new Date(dateTimeOriginal) : new Date(imageAsset._createdAt);


    return <Dialog>
        <DialogTrigger>
            <Badge variant="secondary" className="font-mono opacity-75 hover:opacity-100 cursor-pointer transition-opacity">
                {createdAt.toLocaleDateString("no")} at {createdAt.toLocaleTimeString('no')}
                <InfoIcon size={16} className="ml-2" />
            </Badge>
        </DialogTrigger>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Metadata</DialogTitle>
            </DialogHeader>
            <DialogDescription>
                <li className="list-none"><Clock size={16} className="mr-2 inline-block" /> created:  {createdAt.toLocaleDateString("no")} at {createdAt.toLocaleTimeString('no')}</li>
                <li className="list-none"><MapPin size={16} className="mr-2 inline-block" /> {meta.location ? `lat: ${meta.location?.lat}, lng: ${meta.location?.lng}` : 'no location'}</li>
                <li className="list-none"><Camera size={16} className="mr-2 inline-block" /> {exif?.lensMake && exif?.lensModel ? `${exif.lensMake} ${exif.lensModel}` : 'no camera info'}</li>
            </DialogDescription>

            <DialogFooter><p className="text-xs text-muted-foreground">🚨 Metadata may be wrong due to many factors like wrong camera settings, wrong date/time, wrong location, etc.</p></DialogFooter>
        </DialogContent>
    </Dialog>
}