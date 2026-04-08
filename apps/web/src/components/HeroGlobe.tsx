"use client";

import { useEffect, useRef } from "react";
import GlobeSection from "./GlobeSection";
import type { GlobeLocation } from "./GlobeSection";
import { useHeroGlobe } from "@/contexts/HeroGlobeContext";

interface HeroGlobeProps {
  allLocations: GlobeLocation[];
}

export default function HeroGlobe({ allLocations }: HeroGlobeProps) {
  const { heroVisible, setHeroVisible } = useHeroGlobe();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setHeroVisible(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [setHeroVisible]);

  return (
    <div ref={sentinelRef} className="relative flex flex-col items-center pt-12 lg:pt-20">
      <div
        className={`w-full max-w-[750px] aspect-square transition-all duration-700 ease-out ${
          heroVisible ? "opacity-100 scale-100" : "opacity-0 scale-90"
        }`}
      >
        <GlobeSection mode="hero" allLocations={allLocations} paused={!heroVisible} draggable />
      </div>

      <div
        className={`flex flex-col items-center gap-2 transition-opacity duration-500 ${
          heroVisible ? "opacity-30 animate-bounce" : "opacity-0"
        }`}
      >
        <div className="w-px h-8 bg-gradient-to-b from-muted-foreground to-transparent" />
      </div>
    </div>
  );
}
