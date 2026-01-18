'use client';

import { useRef } from "react";
import { SelfHostedMedia } from "./FeedMedia";
import { VideoControls, useVideoControls } from "./ui/VideoControls";

interface VideoProps {
  video: SelfHostedMedia;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  showControls?: boolean;
}

export default function Video({ video, videoRef, showControls = true }: VideoProps) {
  const internalRef = useRef<HTMLVideoElement>(null);
  const activeRef = videoRef || internalRef;
  const controls = useVideoControls(activeRef);

  if (!video.url || video.mediaType !== 'video') return null;

  return (
    <div className="group relative w-full h-full overflow-hidden rounded-lg">
      {/* Layer 1 (bottom): LQIP blur placeholder */}
      {video.lqip && (
        <div
          className="absolute inset-0 z-10"
          style={{
            backgroundImage: `url(${video.lqip})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
          }}
        />
      )}

      {/* Layer 2 (middle): Thumbnail - covers LQIP when loaded */}
      {video.thumbnailUrl && (
        <img
          src={video.thumbnailUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover z-20"
        />
      )}

      {/* Layer 3 (top): Video - covers thumbnail when playing */}
      <video
        ref={activeRef}
        autoPlay
        muted
        loop
        className="absolute inset-0 w-full h-full object-cover z-30"
        playsInline
      >
        {video.mimeType ? (
          <source src={video.url} type={video.mimeType} />
        ) : (
          <source src={video.url} />
        )}
      </video>

      {/* Layer 4: Custom controls overlay */}
      {showControls && (
        <VideoControls
          videoRef={activeRef}
          isPlaying={controls.isPlaying}
          isMuted={controls.isMuted}
          currentTime={controls.currentTime}
          duration={controls.duration}
          onPlayPause={controls.togglePlay}
          onMuteToggle={controls.toggleMute}
          onSeek={controls.seek}
          showVolumeSlider={true}
        />
      )}
    </div>
  );
}
