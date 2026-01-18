import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogTrigger, DialogFooter } from "./ui/dialog";
import { Camera, Clock, InfoIcon, MapPin } from "lucide-react";
import { SelfHostedMedia } from "./FeedMedia";
import { Badge } from "./ui/badge";

interface MetadataDialogProps {
  media: SelfHostedMedia;
  createdAt?: Date;
}

export default function MetadataDialog({ media, createdAt }: MetadataDialogProps) {
  const { exif, location } = media;

  // Don't render if no date available to avoid hydration mismatch with new Date()
  if (!createdAt) return null;

  return (
    <Dialog>
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
          <li className="list-none">
            <Clock size={16} className="mr-2 inline-block" />
            created: {createdAt.toLocaleDateString("no")} at {createdAt.toLocaleTimeString('no')}
          </li>
          <li className="list-none">
            <MapPin size={16} className="mr-2 inline-block" />
            {location ? `lat: ${location.lat}, lon: ${location.lon}` : 'no location'}
          </li>
          <li className="list-none">
            <Camera size={16} className="mr-2 inline-block" />
            {exif?.lensMake && exif?.lensModel ? `${exif.lensMake} ${exif.lensModel}` : 'no camera info'}
          </li>
        </DialogDescription>
        <DialogFooter>
          <p className="text-xs text-muted-foreground">
            Metadata may be inaccurate due to camera settings, wrong date/time, wrong location, etc.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
