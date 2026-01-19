"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface IntroAnimationProps {
  children: React.ReactNode;
}

export default function IntroAnimation({ children }: IntroAnimationProps) {
  const [phase, setPhase] = useState<"mounting" | "cursor" | "typing" | "pause" | "shrinking" | "done">("mounting");
  const [displayText, setDisplayText] = useState("");
  const [targetPosition, setTargetPosition] = useState<{ top: number; left: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
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

      {/* The animating title - fixed position that transforms to header location */}
      {showTitle && (
        <h1
          className="fixed z-50 font-array text-foreground transition-all ease-out"
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
