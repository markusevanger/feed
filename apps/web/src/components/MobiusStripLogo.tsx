"use client";

import { useEffect, useRef } from "react";

interface MobiusStripLogoProps {
  className?: string;
}

export default function MobiusStripLogo({ className = "" }: MobiusStripLogoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Ensure video plays on mount
    videoRef.current?.play().catch(() => {
      // Autoplay may be blocked, that's ok
    });
  }, []);

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
    >
      <source src="/mobius-strip-logo.mp4" type="video/mp4" />
    </video>
  );
}
