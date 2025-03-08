import { Suspense } from "react";
import { VideoType, MediaWrapper } from "./FeedMedia";
import { cn } from "@/lib/utils";
import VideoSkeleton from "./ui/VideoSkeleton";

export default function Video({ video, className }: { video: VideoType; className?: string }) {
    if (!video.asset?.url) return null;

    const createdAt = video.asset._createdAt ? new Date(video.asset._createdAt) : undefined;
    const orientation = video.orientation;

    return (
        <MediaWrapper
            createdAt={createdAt}
            assetId={video.asset._id}
            className={cn(className, orientation === "horizontal" ? "col-span-2" : "")}
        >
            <Suspense fallback={<VideoSkeleton />}>
                <video
                    autoPlay
                    muted
                    loop
                    className="rounded-lg w-full h-full object-cover"
                    playsInline
                >
                    <source src={video.asset?.url} type={video.asset?.mimeType ?? undefined} />
                    Your browser does not support the video tag.
                </video>
            </Suspense>
        </MediaWrapper>
    )
}

