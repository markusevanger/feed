"use client"

import { useState } from "react";
import { Camera, ChevronUp, Clock, MapPin, X } from "lucide-react";
import { SelfHostedMedia } from "./FeedMedia";
import { cn } from "@/lib/utils";

interface MetadataDialogProps {
  media: SelfHostedMedia;
  createdAt?: Date;
}

export default function MetadataDialog({ media, createdAt }: MetadataDialogProps) {
  const [expanded, setExpanded] = useState(false);
  const { exif, location } = media;

  // Don't render if no date available to avoid hydration mismatch with new Date()
  if (!createdAt) return null;

  return (
    <div
      className={cn(
        "absolute z-10 font-mono text-xs cursor-pointer transition-all duration-200 ease-out",
        "bg-secondary text-secondary-foreground",
        expanded
          ? "bottom-2 left-4 right-4 px-4 py-3 rounded-lg"
          : "bottom-2 left-4 px-2.5 py-0.5 rounded-md opacity-75 hover:opacity-100"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center">
          <Clock size={12} className="mr-1.5 shrink-0" />
          {createdAt.toLocaleDateString("no")} at {createdAt.toLocaleTimeString('no')}
          {!expanded && <ChevronUp size={14} className="ml-1.5" />}
        </span>
        {expanded && (
          <button
            className="p-0.5 rounded-full hover:bg-foreground/10 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            aria-label="Close metadata"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 space-y-1 text-secondary-foreground/90">
          <div className="flex items-center">
            <MapPin size={12} className="mr-1.5 shrink-0" />
            <span>{location ? `${location.lat}, ${location.lon}` : 'No location'}</span>
          </div>
          <div className="flex items-center">
            <Camera size={12} className="mr-1.5 shrink-0" />
            <span>{exif?.lensMake && exif?.lensModel ? `${exif.lensMake} ${exif.lensModel}` : 'No camera info'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
