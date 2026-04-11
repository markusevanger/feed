"use client";

import { Badge } from "@/components/ui/badge";
import GlobeSection from "@/components/GlobeSection";
import { useHeroGlobe } from "@/contexts/HeroGlobeContext";
import { ArrowUp, Home, Menu, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface Post {
  _id: string;
  title: string | null;
  slug: string | null;
}

interface GlobeLocation {
  lat: number;
  lon: number;
  postSlug: string;
  postTitle: string;
  count: number;
}

interface PostFilterBadgesProps {
  posts: Post[];
  position: "fixed" | "footer";
  globeLocations?: GlobeLocation[];
}

export default function PostFilterBadges({ posts, position, globeLocations }: PostFilterBadgesProps) {
  const { heroVisible } = useHeroGlobe();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;

      // Hide navbar when at top
      setIsVisible(window.scrollY > 80);

      // Check if scrolled to bottom (within 100px threshold)
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const scrollTop = window.scrollY;
      setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 100);

      for (const post of posts) {
        if (!post.slug) continue;
        const element = document.getElementById(`post-${post.slug}`);
        if (element) {
          const { top, bottom } = element.getBoundingClientRect();
          const elementTop = top + window.scrollY;
          const elementBottom = bottom + window.scrollY;

          if (scrollPosition >= elementTop && scrollPosition < elementBottom) {
            setActiveSlug(post.slug);
            return;
          }
        }
      }

      if (window.scrollY < 100) {
        setActiveSlug(null);
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [posts]);

  const scrollToPost = useCallback((slug: string | null) => {
    if (slug === null) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const element = document.getElementById(`post-${slug}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, []);

  // Find the first location for the active post
  const focusLocation = useMemo(() => {
    if (!activeSlug || !globeLocations) return null;
    const match = globeLocations.find((loc) => loc.postSlug === activeSlug);
    return match ? { lat: match.lat, lon: match.lon, label: match.postTitle } : null;
  }, [activeSlug, globeLocations]);

  // Footer position: render the "Go to top" button when at bottom
  if (position === "footer") {
    return (
      <div className={`lg:hidden transition-opacity duration-300 ${isAtBottom ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="flex gap-2 bg-background/80 backdrop-blur-sm border border-border rounded-full px-3 py-2 shadow-lg">
          <Badge
            variant="default"
            className="rounded-full px-3 py-1 text-xs shrink-0 cursor-pointer"
            onClick={() => scrollToPost(null)}
          >
            <span className="flex items-center gap-1">
              <ArrowUp className="size-3" /> Go to top
            </span>
          </Badge>
        </div>
      </div>
    );
  }

  // Fixed position: render desktop sidebar and mobile floating bar
  return (
    <>
      {/* Desktop: fixed on left side */}
      {(() => {
        const show = isVisible && !heroVisible;
        return (
          <div className={`fixed left-4 top-1/2 z-50 hidden lg:flex flex-col items-start gap-2 -translate-y-1/2 ${show ? "" : "pointer-events-none"}`}>
            {globeLocations && globeLocations.length > 0 && (
              <div
                className="relative w-40 mb-1 aspect-square"
                style={{
                  opacity: show ? 1 : 0,
                  transform: show ? "translateX(0)" : "translateX(-24px)",
                  transition: show
                    ? "opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)"
                    : "opacity 0.2s ease-in, transform 0.25s ease-in",
                }}
              >
                <GlobeSection mode="sidebar" focusLocation={focusLocation} paused={!show} />
                {focusLocation?.label && (
                  <div
                    className="absolute pointer-events-none font-mono text-[10px] text-white whitespace-nowrap transition-opacity duration-300"
                    style={{
                      positionAnchor: "--cobe-active" as string,
                      bottom: "anchor(top)",
                      left: "anchor(center)",
                      translate: "-50% 0",
                      opacity: "var(--cobe-visible-active, 0)",
                    } as React.CSSProperties}
                  >
                    {focusLocation.label}
                  </div>
                )}
              </div>
            )}
            {[
              { key: "home", slug: null, label: <><Home className="size-3" /> Home</> },
              ...posts.map((post) => ({ key: post._id, slug: post.slug, label: post.title || "Untitled" })),
            ].map((item, i) => {
              const idx = i + 1; // offset by 1 so globe is "index 0"
              return (
                <Badge
                  key={item.key}
                  variant={activeSlug === item.slug ? "default" : "outline"}
                  className={`cursor-pointer rounded-full ${item.slug === null ? "px-2" : "px-3"} py-1 text-xs hover:bg-primary hover:text-primary-foreground flex items-center gap-1 ${activeSlug === item.slug ? "translate-x-1" : ""}`}
                  style={{
                    opacity: show ? 1 : 0,
                    transform: show
                      ? `translateX(${activeSlug === item.slug ? "4px" : "0"})`
                      : "translateX(-24px)",
                    transition: show
                      ? `opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 0.05}s, transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 0.05}s`
                      : `opacity 0.2s ease-in ${(posts.length + 1 - idx) * 0.025}s, transform 0.25s ease-in ${(posts.length + 1 - idx) * 0.025}s`,
                  }}
                  onClick={() => scrollToPost(item.slug)}
                >
                  {item.label}
                </Badge>
              );
            })}
          </div>
        );
      })()}

      {/* Mobile: backdrop when menu open */}
      <div
        className={`fixed inset-0 z-40 lg:hidden bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${mobileMenuOpen && isVisible && !isAtBottom ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile: floating bottom bar with current post + menu */}
      <div className={`fixed right-4 bottom-4 z-50 lg:hidden transition-all duration-300 ${isVisible && !isAtBottom ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="flex gap-2 bg-background/80 backdrop-blur-sm border border-border rounded-full px-3 py-2 shadow-lg">
          <Badge
            variant="default"
            className="rounded-full px-3 py-1 text-xs shrink-0"
          >
            {posts.find((p) => p.slug === activeSlug)?.title || "Top"}
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer rounded-full px-2 py-1 text-xs shrink-0 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Badge>
        </div>
      </div>

      {/* Mobile: expanded menu */}
      <div className={`fixed right-4 z-40 lg:hidden transition-all duration-300 ${isVisible && mobileMenuOpen && !isAtBottom ? "bottom-20 opacity-100" : "bottom-16 opacity-0 pointer-events-none"}`}>
        <div className="flex items-end gap-3 bg-background/80 backdrop-blur-sm border border-border rounded-2xl px-3 py-3 shadow-lg">
          {globeLocations && globeLocations.length > 0 && (
            <div className="w-24 aspect-square shrink-0">
              <GlobeSection mode="sidebar" focusLocation={focusLocation} paused={!mobileMenuOpen} />
            </div>
          )}
          <div className="flex flex-col items-end gap-2">
            <Badge
              variant={activeSlug === null ? "default" : "outline"}
              className="cursor-pointer rounded-full px-2 py-1 text-xs transition-colors flex items-center gap-1"
              onClick={() => {
                scrollToPost(null);
                setMobileMenuOpen(false);
              }}
            >
              <Home className="size-3" /> Top
            </Badge>
            {posts.map((post) => (
              <Badge
                key={post._id}
                variant={activeSlug === post.slug ? "default" : "outline"}
                className="cursor-pointer rounded-full px-3 py-1 text-xs transition-colors"
                onClick={() => {
                  scrollToPost(post.slug);
                  setMobileMenuOpen(false);
                }}
              >
                {post.title || "Untitled"}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
