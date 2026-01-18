"use client";

import { useState, useEffect, useRef } from "react";
import { useWindupString } from "windups";

interface IntroAnimationProps {
  children: React.ReactNode;
}

export default function IntroAnimation({ children }: IntroAnimationProps) {
  const [phase, setPhase] = useState<"mounting" | "windup" | "pause" | "shrinking" | "done">("mounting");
  const [windupText, { isFinished }] = useWindupString("feed");
  const [targetPosition, setTargetPosition] = useState<{ top: number; left: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Start animation after mount to avoid hydration issues
  useEffect(() => {
    setPhase("windup");
  }, []);

  // Measure the actual header position from the rendered (but invisible) content
  useEffect(() => {
    if (phase !== "mounting" && contentRef.current) {
      const header = contentRef.current.querySelector("h1.font-array");
      if (header) {
        const rect = header.getBoundingClientRect();
        setTargetPosition({ top: rect.top, left: rect.left });
      }
    }
  }, [phase]);

  useEffect(() => {
    if (isFinished && phase === "windup") {
      const pauseTimer = setTimeout(() => {
        setPhase("pause");
      }, 100);
      return () => clearTimeout(pauseTimer);
    }
  }, [isFinished, phase]);

  useEffect(() => {
    if (phase === "pause") {
      const shrinkTimer = setTimeout(() => {
        setPhase("shrinking");
      }, 1000);
      return () => clearTimeout(shrinkTimer);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "shrinking") {
      const doneTimer = setTimeout(() => {
        setPhase("done");
      }, 1500);
      return () => clearTimeout(doneTimer);
    }
  }, [phase]);

  // During SSR and initial mount, just render children normally
  if (phase === "mounting") {
    return <>{children}</>;
  }

  const isDone = phase === "done";
  const isShrinking = phase === "shrinking";

  return (
    <>
      {/* Black overlay - fades out during shrink */}
      {!isDone && (
        <div
          className={`fixed inset-0 z-40 bg-black transition-opacity duration-1000 ${
            isShrinking ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          style={{ transitionDelay: isShrinking ? "0.5s" : "0s" }}
        />
      )}

      {/* The animating title - fixed position that transforms to header location */}
      {!isDone && (
        <h1
          className="fixed z-50 font-array text-white transition-all ease-out"
          style={{
            top: isShrinking && targetPosition ? targetPosition.top : "50%",
            left: isShrinking && targetPosition ? targetPosition.left : "50%",
            transform: isShrinking
              ? "translate(0, 0)"
              : "translate(-50%, -50%)",
            fontSize: isShrinking ? "1.5rem" : "7.5vw",
            transitionDuration: "1.5s",
            transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {windupText}<span className="animate-pulse">_</span>
        </h1>
      )}

      {/* Main content - invisible during animation but rendered to measure positions */}
      <div
        ref={contentRef}
        className={`transition-opacity duration-500 ${
          isDone ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {children}
      </div>
    </>
  );
}
