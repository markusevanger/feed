import { Suspense } from "react";
import { SelfHostedVideo, MediaWrapper } from "./FeedMedia";
import { cn } from "@/lib/utils";
import VideoSkeleton from "./ui/VideoSkeleton";

export default function Video({ video, className }: { video: SelfHostedVideo; className?: string }) {
  if (!video.url) return null;

  return (
    <MediaWrapper
      className={cn(className, video.orientation === "horizontal" ? "col-span-2" : "")}
    >
      <Suspense fallback={<VideoSkeleton />}>
        <video
          autoPlay
          muted
          loop
          className="rounded-lg w-full h-full object-cover"
          playsInline
        >
          <source src={video.url} type={video.mimeType} />
          Your browser does not support the video tag.
        </video>
      </Suspense>
    </MediaWrapper>
  );
}
