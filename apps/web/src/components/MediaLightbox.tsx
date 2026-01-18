"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { VideoControls, useVideoControls } from "./ui/VideoControls"

interface ImageLightboxProps {
  type: "image"
  src: string
  alt: string
  width: number
  height: number
  lqip?: string
  children: React.ReactNode
}

interface VideoLightboxProps {
  type: "video"
  src: string
  mimeType?: string
  videoRef?: React.RefObject<HTMLVideoElement | null>
  children: React.ReactNode
}

type MediaLightboxProps = ImageLightboxProps | VideoLightboxProps

export function MediaLightbox(props: MediaLightboxProps) {
  const [open, setOpen] = React.useState(false)
  const [isAnimating, setIsAnimating] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const lightboxVideoRef = React.useRef<HTMLVideoElement>(null)
  const [transform, setTransform] = React.useState({ x: 0, y: 0, scale: 0.5 })
  const [videoStartTime, setVideoStartTime] = React.useState(0)

  const calculateTransform = () => {
    if (!triggerRef.current) return { x: 0, y: 0, scale: 0.5 }

    const rect = triggerRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Center of the trigger element
    const originX = rect.left + rect.width / 2
    const originY = rect.top + rect.height / 2

    // Center of the viewport
    const centerX = viewportWidth / 2
    const centerY = viewportHeight / 2

    // Calculate translation from center to origin
    const translateX = originX - centerX
    const translateY = originY - centerY

    // Calculate scale based on trigger size vs viewport
    const maxWidth = viewportWidth * 0.9
    const maxHeight = viewportHeight * 0.9
    const scaleX = rect.width / maxWidth
    const scaleY = rect.height / maxHeight
    const scale = Math.max(scaleX, scaleY, 0.1)

    return { x: translateX, y: translateY, scale }
  }

  const handleOpen = () => {
    setTransform(calculateTransform())
    setIsAnimating(true)

    // For videos, pause the feed video and capture its current time
    if (props.type === "video" && props.videoRef?.current) {
      const feedVideo = props.videoRef.current
      setVideoStartTime(feedVideo.currentTime)
      feedVideo.pause()
    }

    setOpen(true)
    setTimeout(() => setIsAnimating(false), 150)
  }

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setTransform(calculateTransform())
      setIsAnimating(true)

      // Resume the feed video from where lightbox left off
      if (props.type === "video" && props.videoRef?.current && lightboxVideoRef.current) {
        const feedVideo = props.videoRef.current
        feedVideo.currentTime = lightboxVideoRef.current.currentTime
        feedVideo.play()
      }
    }
    setOpen(newOpen)
  }

  // Sync lightbox video to feed video's position when metadata is loaded
  const handleVideoLoaded = () => {
    if (lightboxVideoRef.current && videoStartTime > 0) {
      lightboxVideoRef.current.currentTime = videoStartTime
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleClose}>
      <DialogPrimitive.Trigger asChild>
        <button
          ref={triggerRef}
          className="w-full h-full cursor-pointer focus:outline-none"
          onClick={handleOpen}
        >
          {props.children}
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/90 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-150"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 cursor-pointer",
            "duration-150"
          )}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose(false)
            }
          }}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Close
            className={cn(
              "absolute top-4 right-4 z-50 rounded-full p-2",
              "bg-black/50 text-white hover:bg-black/70",
              "transition-colors focus:outline-none focus:ring-2 focus:ring-white/50",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "duration-150"
            )}
          >
            <XIcon className="size-6" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          <DialogPrimitive.Title className="sr-only">
            {props.type === "image" ? props.alt : "Video"}
          </DialogPrimitive.Title>

          <div
            className="relative max-h-[90vh] max-w-[90vw] cursor-default transition-all duration-150 ease-out"
            style={{
              transform: isAnimating && !open
                ? `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
                : 'translate(0, 0) scale(1)',
              opacity: isAnimating && !open ? 0 : 1,
              // For opening animation, start from the calculated position
              ...(isAnimating && open ? {
                animation: 'lightbox-zoom-in 150ms ease-out forwards',
                '--start-x': `${transform.x}px`,
                '--start-y': `${transform.y}px`,
                '--start-scale': transform.scale,
              } as React.CSSProperties : {}),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {props.type === "image" ? (
              <Image
                src={props.src}
                alt={props.alt}
                width={props.width}
                height={props.height}
                placeholder={props.lqip ? "blur" : "empty"}
                blurDataURL={props.lqip || undefined}
                className="max-h-[90vh] max-w-[90vw] w-auto h-auto object-contain rounded-lg"
                priority
              />
            ) : (
              <LightboxVideo
                videoRef={lightboxVideoRef}
                src={props.src}
                mimeType={props.mimeType}
                onLoadedMetadata={handleVideoLoaded}
              />
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

interface LightboxVideoProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  src: string
  mimeType?: string
  onLoadedMetadata: () => void
}

function LightboxVideo({ videoRef, src, mimeType, onLoadedMetadata }: LightboxVideoProps) {
  const controls = useVideoControls(videoRef)

  return (
    <div className="group relative max-h-[90vh] max-w-[90vw]">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop
        onLoadedMetadata={onLoadedMetadata}
        className="max-h-[90vh] max-w-[90vw] w-auto h-auto object-contain rounded-lg"
        playsInline
      >
        {mimeType && <source src={src} type={mimeType} />}
      </video>

      <VideoControls
        videoRef={videoRef}
        isPlaying={controls.isPlaying}
        isMuted={controls.isMuted}
        currentTime={controls.currentTime}
        duration={controls.duration}
        onPlayPause={controls.togglePlay}
        onMuteToggle={controls.toggleMute}
        onSeek={controls.seek}
        showVolumeSlider={true}
        className="rounded-b-lg"
      />
    </div>
  )
}
