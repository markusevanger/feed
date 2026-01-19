"use client";

import { Badge } from "@/components/ui/badge";
import { Home, Menu, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Post {
  _id: string;
  title: string | null;
  slug: string | null;
}

interface PostFilterBadgesProps {
  posts: Post[];
}

export default function PostFilterBadges({ posts }: PostFilterBadgesProps) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;

      // Hide navbar when at top
      setIsVisible(window.scrollY > 200);

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

  return (
    <>
      {/* Desktop: fixed on left side */}
      <div className="fixed left-4 top-1/2 z-50 hidden lg:flex flex-col gap-2 -translate-y-1/2">
        <Badge
          variant={activeSlug === null ? "default" : "outline"}
          className="cursor-pointer rounded-full px-2 py-1 text-xs hover:bg-primary hover:text-primary-foreground transition-colors flex items-center gap-1"
          onClick={() => scrollToPost(null)}
        >
          <Home className="size-3" /> Home
        </Badge>
        {posts.map((post) => (
          <Badge
            key={post._id}
            variant={activeSlug === post.slug ? "default" : "outline"}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs hover:bg-primary hover:text-primary-foreground transition-all duration-200 ${activeSlug === post.slug ? "translate-x-1" : ""}`}
            onClick={() => scrollToPost(post.slug)}
          >
            {post.title || "Untitled"}
          </Badge>
        ))}
      </div>

      {/* Mobile: backdrop when menu open */}
      <div
        className={`fixed inset-0 z-40 lg:hidden bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${mobileMenuOpen && isVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile: floating bottom bar with current post + menu */}
      <div className={`fixed right-4 z-50 lg:hidden transition-all duration-300 ${isVisible ? "bottom-4" : "-bottom-16 pointer-events-none"}`}>
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
      <div className={`fixed right-4 z-40 lg:hidden transition-all duration-300 ${isVisible && mobileMenuOpen ? "bottom-20 opacity-100" : "bottom-16 opacity-0 pointer-events-none"}`}>
        <div className="flex flex-col items-end gap-2 bg-background/80 backdrop-blur-sm border border-border rounded-2xl px-3 py-3 shadow-lg">
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
    </>
  );
}
