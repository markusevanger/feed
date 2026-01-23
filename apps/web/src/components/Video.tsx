'use client';

import { useRef, useEffect, useState } from "react";
import { SelfHostedMedia } from "./FeedMedia";
import { VideoControls, useVideoControls } from "./ui/VideoControls";
import { useMediaVisibility, VisibilityState } from "@/hooks/useMediaVisibility";

interface VideoProps {
  video: SelfHostedMedia;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  showControls?: boolean;
  /** Pass visibility state from parent (for FeedMedia integration) */
  visibility?: VisibilityState;
}

export default function Video({ video, videoRef, showControls = true, visibility }: VideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef<HTMLVideoElement>(null);
  const activeRef = videoRef || internalRef;
  const controls = useVideoControls(activeRef);

  // Use provided visibility or track our own
  const ownVisibility = useMediaVisibility(containerRef);
  const { isVisible, shouldDeload } = visibility || ownVisibility;

  // Track if video has been loaded (for deloading logic)
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isDeloaded, setIsDeloaded] = useState(false);

  // Store video URL for reloading after deload
  const videoUrl = video.url;

  // Pause/play based on visibility
  useEffect(() => {
    const videoEl = activeRef.current;
    if (!videoEl || isDeloaded) return;

    if (isVisible) {
      videoEl.play().catch(() => {
        // Ignore autoplay failures (user hasn't interacted yet)
      });
    } else {
      videoEl.pause();
    }
  }, [isVisible, activeRef, isDeloaded]);

  // Deload video when far off-screen to free memory
  useEffect(() => {
    const videoEl = activeRef.current;
    if (!videoEl) return;

    if (shouldDeload && videoLoaded && !isDeloaded) {
      // Pause and clear source to release memory
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load(); // Triggers resource release
      setIsDeloaded(true);
    } else if (!shouldDeload && isDeloaded && videoUrl) {
      // Reload video when coming back into view
      videoEl.src = videoUrl;
      videoEl.load();
      setIsDeloaded(false);
    }
  }, [shouldDeload, videoLoaded, isDeloaded, activeRef, videoUrl]);

  if (!video.url || video.mediaType !== 'video') return null;

  return (
    <div ref={containerRef} className="group relative w-full h-full overflow-hidden rounded-lg">
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

      {/* Layer 2 (middle): Thumbnail - covers LQIP when loaded, shown when deloaded */}
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
        autoPlay={isVisible && !isDeloaded}
        muted
        loop
        className="absolute inset-0 w-full h-full object-cover z-30"
        playsInline
        onCanPlay={() => setVideoLoaded(true)}
      >
        {!isDeloaded && (
          video.mimeType ? (
            <source src={video.url} type={video.mimeType} />
          ) : (
            <source src={video.url} />
          )
        )}
      </video>

      {/* Layer 4: Custom controls overlay */}
      {showControls && !isDeloaded && (
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
