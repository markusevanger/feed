"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface IntroAnimationProps {
  children: React.ReactNode;
}

export default function IntroAnimation({ children }: IntroAnimationProps) {
  const [phase, setPhase] = useState<"mounting" | "cursor" | "typing" | "pause" | "shrinking" | "done">("mounting");
  const [displayText, setDisplayText] = useState("");
  const [targetPosition, setTargetPosition] = useState<{ x: number; y: number } | null>(null);
  const [centerPosition, setCenterPosition] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const fullText = "feed";

  // Typing animation
  const typeText = useCallback(() => {
    const charDelay = 100; // 100ms per character - natural typing speed
    let currentIndex = 0;

    const typeNextChar = () => {
      if (currentIndex < fullText.length) {
        setDisplayText(fullText.slice(0, currentIndex + 1));
        currentIndex++;
        setTimeout(typeNextChar, charDelay);
      } else {
        setPhase("pause");
      }
    };

    typeNextChar();
  }, []);

  // Start animation after mount to avoid hydration issues
  useEffect(() => {
    // Scroll to top on mount to ensure animation starts from correct position
    window.scrollTo(0, 0);
    setPhase("cursor");
  }, []);

  // Cursor phase: wait 1 second showing only "_"
  useEffect(() => {
    if (phase === "cursor") {
      const timer = setTimeout(() => {
        setPhase("typing");
        typeText();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [phase, typeText]);

  // Measure positions after typing is done (when we have full text rendered)
  useEffect(() => {
    if (phase === "pause" && contentRef.current && titleRef.current) {
      // Measure target header position
      const header = contentRef.current.querySelector("h1.font-array");
      if (header) {
        const targetRect = header.getBoundingClientRect();
        const currentRect = titleRef.current.getBoundingClientRect();

        // Calculate scale based on actual rendered heights
        const targetScale = targetRect.height / currentRect.height;
        setScale(targetScale);

        // Calculate where center of viewport is
        const viewportCenterX = window.innerWidth / 2;
        const viewportCenterY = window.innerHeight / 2;

        // Current title is centered, so its center should be at viewport center
        // We want to translate from current center to target position
        setCenterPosition({ x: viewportCenterX, y: viewportCenterY });

        // Target: center of the header element
        setTargetPosition({
          x: targetRect.left + targetRect.width / 2,
          y: targetRect.top + targetRect.height / 2
        });
      }
    }
  }, [phase]);

  // Pause phase: wait before shrinking
  useEffect(() => {
    if (phase === "pause") {
      const shrinkTimer = setTimeout(() => {
        setPhase("shrinking");
      }, 500);
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

  const isDone = phase === "done";
  const isShrinking = phase === "shrinking";
  const showOverlay = phase !== "done";
  const showTitle = phase !== "mounting" && phase !== "done";

  // Calculate transform for shrinking phase
  const getTransform = () => {
    if (isShrinking && targetPosition && centerPosition) {
      const dx = targetPosition.x - centerPosition.x;
      const dy = targetPosition.y - centerPosition.y;
      return `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`;
    }
    return "translate(-50%, -50%) scale(1)";
  };

  return (
    <>
      {/* Background overlay - shown during mounting to prevent flash, fades out during shrink */}
      {showOverlay && (
        <div
          className={`fixed inset-0 z-40 bg-background transition-opacity duration-1000 ${
            isShrinking ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          style={{ transitionDelay: isShrinking ? "0.5s" : "0s" }}
        />
      )}

      {/* The animating title - uses transform only for smooth animation */}
      {showTitle && (
        <h1
          ref={titleRef}
          className="fixed z-50 font-array text-foreground"
          style={{
            top: "50%",
            left: "50%",
            fontSize: "7.5vw",
            transform: getTransform(),
            transition: isShrinking
              ? "transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)"
              : "none",
            transformOrigin: "center center",
          }}
        >
          {displayText}<span className="animate-pulse">_</span>
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
