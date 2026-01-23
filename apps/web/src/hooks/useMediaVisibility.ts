'use client';

import { useEffect, useState, useRef, RefObject, startTransition } from 'react';
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
 *
 * Uses startTransition to mark visibility updates as low-priority,
 * preventing them from blocking scroll and causing frame drops.
 */
export function useMediaVisibility(
  ref: RefObject<HTMLElement | null>
): VisibilityState {
  const { observe, unobserve } = useMediaObserver();
  const [isVisible, setIsVisible] = useState(false);
  const [isNearby, setIsNearby] = useState(false);
  const hasBeenVisible = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleIntersection = (entry: IntersectionObserverEntry, zone: 'visible' | 'nearby' | 'far') => {
      if (zone === 'visible') {
        // Use startTransition to make this a low-priority update
        // This prevents visibility changes from blocking scroll
        startTransition(() => {
          setIsVisible(entry.isIntersecting);
        });
        if (entry.isIntersecting) {
          hasBeenVisible.current = true;
        }
      } else if (zone === 'nearby') {
        startTransition(() => {
          setIsNearby(entry.isIntersecting);
        });
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
