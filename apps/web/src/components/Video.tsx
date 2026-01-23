'use client';

import { useRef, useEffect, useState, useCallback } from "react";
import { SelfHostedMedia } from "./FeedMedia";
import { VideoControls, useVideoControls } from "./ui/VideoControls";
import { useMediaVisibility, VisibilityState } from "@/hooks/useMediaVisibility";

// Polyfill requestIdleCallback for Safari
const requestIdleCallbackPolyfill =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? window.requestIdleCallback
    : (cb: IdleRequestCallback) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline), 1);

const cancelIdleCallbackPolyfill =
  typeof window !== 'undefined' && 'cancelIdleCallback' in window
    ? window.cancelIdleCallback
    : clearTimeout;

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

  // Track idle callback for cleanup
  const idleCallbackRef = useRef<number | ReturnType<typeof setTimeout>>(0);

  // Deload video when far off-screen to free memory
  // Uses requestIdleCallback to avoid blocking scroll with expensive load() calls
  useEffect(() => {
    const videoEl = activeRef.current;
    if (!videoEl) return;

    // Cancel any pending idle callback
    if (idleCallbackRef.current) {
      cancelIdleCallbackPolyfill(idleCallbackRef.current as number);
      idleCallbackRef.current = 0;
    }

    if (shouldDeload && videoLoaded && !isDeloaded) {
      // Defer the expensive deload operation to idle time
      idleCallbackRef.current = requestIdleCallbackPolyfill(() => {
        // Re-check conditions in case they changed
        if (!activeRef.current) return;
        // Pause and clear source to release memory
        activeRef.current.pause();
        activeRef.current.removeAttribute('src');
        activeRef.current.load(); // Triggers resource release
        setIsDeloaded(true);
      }, { timeout: 500 }); // Allow up to 500ms before forcing
    } else if (!shouldDeload && isDeloaded && videoUrl) {
      // Reload immediately when coming back - user is waiting
      videoEl.src = videoUrl;
      videoEl.load();
      setIsDeloaded(false);
    }

    return () => {
      if (idleCallbackRef.current) {
        cancelIdleCallbackPolyfill(idleCallbackRef.current as number);
      }
    };
  }, [shouldDeload, videoLoaded, isDeloaded, activeRef, videoUrl]);

  if (!video.url || video.mediaType !== 'video') return null;

  return (
    <div ref={containerRef} className="group relative w-full h-full overflow-hidden rounded-lg">
      {/* Layer 1 (bottom): LQIP blur placeholder */}
      {/* Uses GPU-accelerated blur via CSS class for better scroll perf */}
      {video.lqip && (
        <div
          className="absolute inset-0 z-10 lqip-blur"
          style={{
            backgroundImage: `url(${video.lqip})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
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
