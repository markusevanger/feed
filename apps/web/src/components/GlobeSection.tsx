"use client";

import { useEffect, useRef } from "react";
import createGlobe from "cobe";

export interface GlobeLocation {
  lat: number;
  lon: number;
  label?: string;
}

interface GlobeSectionProps {
  /** Single location to focus on (sidebar mode) */
  focusLocation?: GlobeLocation | null;
  /** All locations to show as markers (hero mode) */
  allLocations?: GlobeLocation[];
  /** Display mode */
  mode?: "hero" | "sidebar";
  /** Pause rendering (stops rAF loop) */
  paused?: boolean;
  /** Allow drag interaction */
  draggable?: boolean;
}

// Convert lat/lon to cobe phi/theta
function locationToAngles(lat: number, lon: number): [number, number] {
  return [
    Math.PI - ((lon * Math.PI) / 180 - Math.PI / 2),
    (lat * Math.PI) / 180,
  ];
}

/** Deduplicate locations by rounding to ~1km grid, keeping first label */
function dedupeLocations(locations: GlobeLocation[]): GlobeLocation[] {
  const seen = new Map<string, GlobeLocation>();
  for (const loc of locations) {
    const key = `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`;
    if (!seen.has(key)) seen.set(key, loc);
  }
  return Array.from(seen.values());
}

function makeMarker(lat: number, lon: number, id?: string, size = 0.07) {
  return {
    location: [lat, lon] as [number, number],
    size,
    ...(id && { id }),
  };
}

export default function GlobeSection({
  focusLocation,
  allLocations,
  mode = "sidebar",
  paused = false,
  draggable = false,
}: GlobeSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPhiRef = useRef(0);
  const currentThetaRef = useRef(0.3);
  const focusRef = useRef(focusLocation);
  const modeRef = useRef(mode);
  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);
  const idleSpeedRef = useRef(0.002);
  const pausedRef = useRef(paused);

  // Drag state
  const pointerDownRef = useRef(false);
  const pointerXRef = useRef(0);
  const pointerYRef = useRef(0);
  const dragPhiRef = useRef(0);
  const dragThetaRef = useRef(0);

  // Deduped hero locations with stable ids
  const heroLocations = allLocations ? dedupeLocations(allLocations) : [];

  // Spin-in animation state
  const wasPausedRef = useRef(paused);
  const spinVelocityRef = useRef(0);

  // Update refs when props change
  useEffect(() => {
    // Spin-in: when sidebar globe becomes visible, kick off a decaying spin
    if (wasPausedRef.current && !paused && mode === "sidebar") {
      spinVelocityRef.current = 0.25;
    }
    wasPausedRef.current = paused;

    focusRef.current = focusLocation;
    modeRef.current = mode;
    pausedRef.current = paused;

    if (globeRef.current) {
      if (mode === "hero" && heroLocations.length) {
        globeRef.current.update({
          markers: heroLocations.map((loc, i) =>
            makeMarker(loc.lat, loc.lon, `loc-${i}`, 0)
          ),
        });
      } else if (focusLocation) {
        globeRef.current.update({
          markers: [makeMarker(focusLocation.lat, focusLocation.lon, "active")],
        });
      } else {
        globeRef.current.update({ markers: [] });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLocation, mode, paused, allLocations]);

  // Globe creation + animation loop
  useEffect(() => {
    if (!canvasRef.current) return;

    let animationId: number;
    const canvas = canvasRef.current;
    let width = canvas.offsetWidth;

    const initialMarkers =
      mode === "hero" && heroLocations.length
        ? heroLocations.map((loc, i) =>
            makeMarker(loc.lat, loc.lon, `loc-${i}`, 0)
          )
        : focusRef.current
          ? [makeMarker(focusRef.current.lat, focusRef.current.lon, "active")]
          : [];

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: currentPhiRef.current,
      theta: currentThetaRef.current,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.3, 0.3, 0.3],
      markerColor: [0.9, 0.9, 0.9],
      glowColor: [0.15, 0.15, 0.15],
      markers: initialMarkers,
    });
    globeRef.current = globe;

    const animate = () => {
      if (pausedRef.current) {
        animationId = requestAnimationFrame(animate);
        return;
      }

      const focus = focusRef.current;
      const currentMode = modeRef.current;

      if (pointerDownRef.current) {
        // User is dragging — don't auto-rotate
      } else if (currentMode === "hero") {
        currentPhiRef.current += idleSpeedRef.current;
      } else if (focus) {
        const [targetPhi, targetTheta] = locationToAngles(focus.lat, focus.lon);
        const distPhi = targetPhi - currentPhiRef.current;
        const normalizedDist =
          ((distPhi % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;

        // Apply spin velocity (decaying spin-in animation)
        if (spinVelocityRef.current > 0.001) {
          currentPhiRef.current += spinVelocityRef.current;
          spinVelocityRef.current *= 0.96;
        } else {
          spinVelocityRef.current = 0;
        }

        currentPhiRef.current += normalizedDist * 0.05;
        currentThetaRef.current +=
          (targetTheta - currentThetaRef.current) * 0.05;
      }

      width = canvas.offsetWidth;
      globe.update({
        phi: currentPhiRef.current,
        theta: currentThetaRef.current,
        width: width * 2,
        height: width * 2,
      });

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
      globe.destroy();
      globeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pointer drag handlers
  useEffect(() => {
    if (!draggable || !canvasRef.current) return;
    const canvas = canvasRef.current;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownRef.current = true;
      pointerXRef.current = e.clientX;
      pointerYRef.current = e.clientY;
      dragPhiRef.current = currentPhiRef.current;
      dragThetaRef.current = currentThetaRef.current;
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDownRef.current) return;
      const dx = e.clientX - pointerXRef.current;
      const dy = e.clientY - pointerYRef.current;
      // Scale movement by canvas size for consistent feel
      const width = canvas.offsetWidth;
      const sensitivity = (Math.PI * 2) / width;
      currentPhiRef.current = dragPhiRef.current + dx * sensitivity;
      currentThetaRef.current = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, dragThetaRef.current + dy * sensitivity)
      );
    };

    const onPointerUp = () => {
      pointerDownRef.current = false;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
    };
  }, [draggable]);

  // In hero mode with labels, render a container with overlaid label divs
  if (mode === "hero" && heroLocations.length > 0) {
    return (
      <div ref={containerRef} className="relative w-full h-full">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          style={{ contain: "layout paint size", touchAction: "none" }}
        />
        {heroLocations.map((loc, i) => (
          <div
            key={`label-${i}`}
            className="absolute pointer-events-none whitespace-nowrap transition-opacity duration-300 flex flex-col items-center"
            style={{
              positionAnchor: `--cobe-loc-${i}`,
              bottom: "anchor(top)",
              left: "anchor(center)",
              translate: "-50% 0",
              opacity: `var(--cobe-visible-loc-${i}, 0)`,
            } as React.CSSProperties}
          >
            <span className="inline-block bg-popover text-popover-foreground text-[10px] font-mono px-2 py-0.5 rounded-md border border-border shadow-md">
              {loc.label}
            </span>
            <svg width="8" height="4" viewBox="0 0 8 4" className="text-border -mt-px">
              <path d="M0 0L4 4L8 0" fill="var(--popover)" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
        ))}
      </div>
    );
  }

  // Sidebar mode — just the canvas
  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ contain: "layout paint size" }}
    />
  );
}
