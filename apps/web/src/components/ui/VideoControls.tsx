"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  PlayIcon,
  PauseIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";

interface VideoControlsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onMuteToggle: () => void;
  onSeek: (time: number) => void;
  showVolumeSlider?: boolean;
  className?: string;
}

export function VideoControls({
  isPlaying,
  isMuted,
  currentTime,
  duration,
  onPlayPause,
  onMuteToggle,
  onSeek,
  showVolumeSlider = true,
  className,
}: VideoControlsProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const progressRef = React.useRef<HTMLDivElement>(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (time: number) => {
    if (!isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(percent * duration);
  };

  const handleProgressDrag = React.useCallback(
    (e: MouseEvent) => {
      if (!progressRef.current || !duration || !isDragging) return;
      const rect = progressRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(percent * duration);
    },
    [duration, isDragging, onSeek]
  );

  const handleDragEnd = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleProgressDrag);
      window.addEventListener("mouseup", handleDragEnd);
      return () => {
        window.removeEventListener("mousemove", handleProgressDrag);
        window.removeEventListener("mouseup", handleDragEnd);
      };
    }
  }, [isDragging, handleProgressDrag, handleDragEnd]);

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-40",
        "bg-gradient-to-t from-black/70 via-black/30 to-transparent",
        "px-3 pb-3 pt-8",
        "opacity-0 transition-opacity duration-200",
        "group-hover:opacity-100 group-focus-within:opacity-100",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Progress bar */}
      <div
        ref={progressRef}
        className="relative h-1 mb-2 cursor-pointer group/progress"
        onClick={handleProgressClick}
        onMouseDown={() => setIsDragging(true)}
      >
        {/* Track background */}
        <div className="absolute inset-0 rounded-full bg-white/30" />
        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white"
          style={{ width: `${progress}%` }}
        />
        {/* Hover/drag thumb */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
            "size-3 rounded-full bg-white shadow-md",
            "opacity-0 scale-75 transition-all",
            "group-hover/progress:opacity-100 group-hover/progress:scale-100",
            isDragging && "opacity-100 scale-100"
          )}
          style={{ left: `${progress}%` }}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2">
        {/* Play/Pause */}
        <ControlButton onClick={onPlayPause} aria-label={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? (
            <PauseIcon className="size-4 fill-current" />
          ) : (
            <PlayIcon className="size-4 fill-current" />
          )}
        </ControlButton>

        {/* Time display */}
        <span className="text-xs text-white/90 font-mono tabular-nums min-w-[70px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="flex-1" />

        {/* Volume */}
        {showVolumeSlider && (
          <div className="flex items-center gap-1 group/volume">
            <ControlButton onClick={onMuteToggle} aria-label={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? (
                <VolumeXIcon className="size-4" />
              ) : (
                <Volume2Icon className="size-4" />
              )}
            </ControlButton>
          </div>
        )}

      </div>
    </div>
  );
}

function ControlButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "flex items-center justify-center",
        "size-8 rounded-full",
        "text-white/90 hover:text-white",
        "bg-white/10 hover:bg-white/20",
        "transition-colors duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// Hook to manage video state
export function useVideoControls(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(true);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleDurationChange = () => setDuration(video.duration);
    const handleVolumeChange = () => setIsMuted(video.muted);

    // Use requestAnimationFrame for smooth progress updates
    const updateTime = () => {
      if (video && !video.paused) {
        setCurrentTime(video.currentTime);
        rafRef.current = requestAnimationFrame(updateTime);
      }
    };

    const startRaf = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateTime);
    };

    const stopRaf = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Final sync on pause
      setCurrentTime(video.currentTime);
    };

    // Initial state
    setIsPlaying(!video.paused);
    setIsMuted(video.muted);
    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);

    // Start RAF if already playing
    if (!video.paused) {
      startRaf();
    }

    video.addEventListener("play", handlePlay);
    video.addEventListener("play", startRaf);
    video.addEventListener("pause", handlePause);
    video.addEventListener("pause", stopRaf);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("loadedmetadata", handleDurationChange);
    video.addEventListener("volumechange", handleVolumeChange);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("play", startRaf);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("pause", stopRaf);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("loadedmetadata", handleDurationChange);
      video.removeEventListener("volumechange", handleVolumeChange);
    };
  }, [videoRef]);

  const togglePlay = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, [videoRef]);

  const toggleMute = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, [videoRef]);

  const seek = React.useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = time;
      // Update state immediately for instant UI feedback
      setCurrentTime(time);
    },
    [videoRef]
  );

  return {
    isPlaying,
    isMuted,
    currentTime,
    duration,
    togglePlay,
    toggleMute,
    seek,
  };
}
