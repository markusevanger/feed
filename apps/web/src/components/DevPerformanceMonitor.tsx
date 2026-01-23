"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface PerformanceData {
  memory: number[];
  fps: number[];
  network: number[];
  currentMemory: number;
  currentFps: number;
  currentNetwork: number;
  peakMemory: number;
  totalDownloaded: number;
  imagesLoaded: number;
  videosLoaded: number;
  fetchRequests: number;
}

const HISTORY_LENGTH = 60;
const UPDATE_INTERVAL = 500;

function MiniGraph({
  data,
  color,
  maxValue,
  label,
  currentValue,
  unit,
}: {
  data: number[];
  color: string;
  maxValue: number;
  label: string;
  currentValue: string;
  unit: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const drawLine = (values: number[], strokeColor: string, fillColor: string) => {
      if (values.length < 2) return;

      const step = width / (HISTORY_LENGTH - 1);

      // Create gradient fill
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, fillColor);
      gradient.addColorStop(1, "transparent");

      // Draw filled area
      ctx.beginPath();
      ctx.moveTo(0, height);

      values.forEach((value, i) => {
        const x = i * step;
        const y = height - (value / maxValue) * height;
        ctx.lineTo(x, y);
      });

      ctx.lineTo((values.length - 1) * step, height);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw line
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      values.forEach((value, i) => {
        const x = i * step;
        const y = height - (value / maxValue) * height;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Glow effect on the line
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    drawLine(data, color, color.replace("1)", "0.2)"));
  }, [data, color, maxValue]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-white/50">
          {label}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-xs tabular-nums" style={{ color }}>
            {currentValue}
          </span>
          <span className="text-[9px] text-white/40">{unit}</span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="h-8 w-full rounded"
        style={{ background: "rgba(0, 0, 0, 0.3)" }}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function DevPerformanceMonitor() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [perfData, setPerfData] = useState<PerformanceData>({
    memory: [],
    fps: [],
    network: [],
    currentMemory: 0,
    currentFps: 0,
    currentNetwork: 0,
    peakMemory: 0,
    totalDownloaded: 0,
    imagesLoaded: 0,
    videosLoaded: 0,
    fetchRequests: 0,
  });

  const lastFrameTime = useRef(performance.now());
  const frameCount = useRef(0);
  const lastNetworkCheck = useRef(0);
  const processedEntries = useRef(new Set<string>());
  const rafId = useRef<number>(0);

  // FPS counter using requestAnimationFrame
  const measureFps = useCallback(() => {
    frameCount.current++;
    rafId.current = requestAnimationFrame(measureFps);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    rafId.current = requestAnimationFrame(measureFps);

    const interval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastFrameTime.current;
      const fps = Math.round((frameCount.current / elapsed) * 1000);
      frameCount.current = 0;
      lastFrameTime.current = now;

      // Memory (if available)
      let memoryMB = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const perfMemory = (performance as any).memory;
      if (perfMemory) {
        memoryMB = Math.round(perfMemory.usedJSHeapSize / 1024 / 1024);
      }

      // Network transfer and resource stats
      let networkDown = 0;
      let totalBytes = 0;
      let images = 0;
      let videos = 0;
      let fetches = 0;

      const entries = performance.getEntriesByType(
        "resource"
      ) as PerformanceResourceTiming[];

      entries.forEach((entry) => {
        const entryKey = `${entry.name}-${entry.startTime}`;
        const isNew = !processedEntries.current.has(entryKey);

        // Count totals (all entries)
        if (entry.transferSize) {
          totalBytes += entry.transferSize;
        }

        // Count by type
        if (entry.initiatorType === "img" || entry.name.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i)) {
          images++;
        } else if (entry.initiatorType === "video" || entry.name.match(/\.(mp4|webm|mov|m3u8)(\?|$)/i)) {
          videos++;
        } else if (entry.initiatorType === "fetch" || entry.initiatorType === "xmlhttprequest") {
          fetches++;
        }

        // Only count recent new entries for the rate
        if (isNew && entry.startTime > now - UPDATE_INTERVAL) {
          if (entry.transferSize) {
            networkDown += entry.transferSize;
          }
          processedEntries.current.add(entryKey);
        }
      });

      // Convert to KB/s
      const downKBps = Math.round((networkDown / 1024 / (UPDATE_INTERVAL / 1000)) * 10) / 10;

      // Smooth the network values
      const smoothDown = lastNetworkCheck.current * 0.3 + downKBps * 0.7;
      lastNetworkCheck.current = smoothDown;

      setPerfData((prev) => ({
        memory: [...prev.memory.slice(-(HISTORY_LENGTH - 1)), memoryMB],
        fps: [...prev.fps.slice(-(HISTORY_LENGTH - 1)), fps],
        network: [...prev.network.slice(-(HISTORY_LENGTH - 1)), smoothDown],
        currentMemory: memoryMB,
        currentFps: fps,
        currentNetwork: smoothDown,
        peakMemory: Math.max(prev.peakMemory, memoryMB),
        totalDownloaded: totalBytes,
        imagesLoaded: images,
        videosLoaded: videos,
        fetchRequests: fetches,
      }));
    }, UPDATE_INTERVAL);

    return () => {
      clearInterval(interval);
      cancelAnimationFrame(rafId.current);
    };
  }, [measureFps]);

  if (process.env.NODE_ENV !== "development") return null;

  const fpsColor =
    perfData.currentFps >= 55
      ? "rgba(74, 222, 128, 1)" // green
      : perfData.currentFps >= 30
        ? "rgba(250, 204, 21, 1)" // yellow
        : "rgba(248, 113, 113, 1)"; // red

  const memoryColor = "rgba(96, 165, 250, 1)"; // blue
  const networkColor = "rgba(192, 132, 252, 1)"; // purple

  return (
    <div
      className={`fixed bottom-14 right-4 z-50 overflow-hidden rounded-lg border border-white/10 bg-black/90 backdrop-blur-md transition-all duration-300 ${
        isCollapsed ? "w-10" : "w-48"
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex w-full items-center justify-between px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-white/70 transition-colors hover:bg-white/5 hover:text-white"
      >
        {!isCollapsed && <span>Performance</span>}
        <svg
          className={`h-3 w-3 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isCollapsed ? "M13 5l7 7-7 7" : "M11 19l-7-7 7-7"}
          />
        </svg>
      </button>

      {/* Graphs */}
      {!isCollapsed && (
        <div className="flex flex-col gap-3 px-2.5 pb-2.5">
          {/* FPS */}
          <MiniGraph
            data={perfData.fps}
            color={fpsColor}
            maxValue={120}
            label="FPS"
            currentValue={perfData.currentFps.toString()}
            unit="fps"
          />

          {/* Memory */}
          <MiniGraph
            data={perfData.memory}
            color={memoryColor}
            maxValue={Math.max(perfData.peakMemory * 1.2, 100)}
            label="Memory"
            currentValue={perfData.currentMemory.toString()}
            unit="MB"
          />

          {/* Network */}
          <MiniGraph
            data={perfData.network}
            color={networkColor}
            maxValue={Math.max(...perfData.network, 10)}
            label="Network"
            currentValue={perfData.currentNetwork.toFixed(1)}
            unit="KB/s"
          />

          {/* Stats */}
          <div className="flex flex-col gap-1.5 border-t border-white/10 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/50">
                Total DL
              </span>
              <span className="font-mono text-[11px] tabular-nums text-white/70">
                {formatBytes(perfData.totalDownloaded)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/50">
                Images
              </span>
              <span className="font-mono text-[11px] tabular-nums text-emerald-400/80">
                {perfData.imagesLoaded}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/50">
                Videos
              </span>
              <span className="font-mono text-[11px] tabular-nums text-amber-400/80">
                {perfData.videosLoaded}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/50">
                Fetches
              </span>
              <span className="font-mono text-[11px] tabular-nums text-sky-400/80">
                {perfData.fetchRequests}
              </span>
            </div>
          </div>

          {/* Pulse indicator */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-[9px] text-white/40">Monitoring</span>
          </div>
        </div>
      )}
    </div>
  );
}
