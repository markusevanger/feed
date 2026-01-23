"use client";

import { useEffect, useState, useCallback } from "react";
import MobiusStripLogo from "./MobiusStripLogo";

const MESSAGE_CHARS = "<33333by<3markus<333333no<3please<3stop<3this<3will overflow!!!!asdfqwerzxcvwhydoesthisexist_________okay_tired_yet?".split("");

export default function Header() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show header when scrolling up or at top
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const handleLogoClick = useCallback(() => {
    if (charIndex >= MESSAGE_CHARS.length) return;
    setCharIndex((prev) => prev + 1);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
  }, [charIndex]);

  // Rewind slowly after 10 seconds of inactivity
  useEffect(() => {
    if (charIndex === 0) return;

    const inactivityTimeout = setTimeout(() => {
      // Start rewinding one character at a time
      const rewindInterval = setInterval(() => {
        setCharIndex((prev) => {
          if (prev <= 0) {
            clearInterval(rewindInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 250); // Slow rewind: one char every 500ms

      return () => clearInterval(rewindInterval);
    }, 3000);

    return () => clearTimeout(inactivityTimeout);
  }, [charIndex]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50 transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <h1 className="flex font-array text-2xl">
          feed<span className="animate-pulse">_</span>
        </h1>
        <div className="flex items-center gap-2">
          {charIndex > 0 && (
            <span
              className="font-array text-xl text-foreground"
              style={{ display: "inline-flex" }}
            >
              {MESSAGE_CHARS.slice(0, charIndex).map((char, i) => (
                <span
                  key={i}
                  className="inline-block"
                  style={{
                    animation: i === charIndex - 1 && isAnimating
                      ? "heartIn 0.3s ease-out forwards"
                      : undefined,
                  }}
                >
                  {char}
                </span>
              ))}
            </span>
          )}
          <button
            onClick={handleLogoClick}
            className="cursor-pointer hover:scale-105 active:scale-95 transition-transform"
            aria-label="Add heart"
          >
            <MobiusStripLogo className="h-8 w-auto" />
          </button>
        </div>
      </div>
    </header>
  );
}
