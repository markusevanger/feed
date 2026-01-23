'use client';

import { useEffect, useState, useRef, RefObject } from 'react';
import { useMediaObserver } from '@/contexts/MediaObserverContext';

export interface VisibilityState {
  /** Currently intersecting with viewport */
  isVisible: boolean;
  /** Within preload zone - should be loaded */
  shouldLoad: boolean;
  /** Far from viewport and was previously loaded - can be deloaded */
  shouldDeload: boolean;
}

/**
 * Hook to track media visibility for lazy loading and deloading.
 * Uses shared IntersectionObserver from MediaObserverContext.
 */
export function useMediaVisibility(
  ref: RefObject<HTMLElement | null>
): VisibilityState {
  const { observe, unobserve, isMobile } = useMediaObserver();
  const [isVisible, setIsVisible] = useState(false);
  const [isNearby, setIsNearby] = useState(false);
  const hasBeenVisible = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleIntersection = (entry: IntersectionObserverEntry, zone: 'visible' | 'nearby' | 'far') => {
      if (zone === 'visible') {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting) {
          hasBeenVisible.current = true;
        }
      } else if (zone === 'nearby') {
        setIsNearby(entry.isIntersecting);
        if (entry.isIntersecting) {
          hasBeenVisible.current = true;
        }
      }
    };

    observe(element, handleIntersection);

    return () => {
      unobserve(element);
    };
  }, [ref, observe, unobserve]);

  // Deload thresholds - only deload if we've been visible before and are now far away
  const shouldDeload = hasBeenVisible.current && !isNearby && !isVisible;

  return {
    isVisible,
    shouldLoad: isVisible || isNearby,
    shouldDeload,
  };
}
