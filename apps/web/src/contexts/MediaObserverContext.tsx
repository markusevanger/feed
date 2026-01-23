'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';

type IntersectionCallback = (entry: IntersectionObserverEntry, zone: 'visible' | 'nearby' | 'far') => void;

interface MediaObserverContextValue {
  observe: (element: Element, callback: IntersectionCallback) => void;
  unobserve: (element: Element) => void;
  isMobile: boolean;
}

const MediaObserverContext = createContext<MediaObserverContextValue | null>(null);

// Thresholds for different device types
const THRESHOLDS = {
  mobile: {
    // Load when within 1 viewport
    nearby: '100%',
  },
  desktop: {
    // Load when within 2 viewports
    nearby: '200%',
  },
};

// Polyfill requestIdleCallback for Safari
const requestIdleCallbackPolyfill =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? window.requestIdleCallback
    : (cb: IdleRequestCallback) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline), 1);

const cancelIdleCallbackPolyfill =
  typeof window !== 'undefined' && 'cancelIdleCallback' in window
    ? window.cancelIdleCallback
    : clearTimeout;

interface MediaObserverProviderProps {
  children: ReactNode;
}

export function MediaObserverProvider({ children }: MediaObserverProviderProps) {
  const [isMobile, setIsMobile] = useState(false);

  // Map of elements to their callbacks
  const callbacksRef = useRef<Map<Element, IntersectionCallback>>(new Map());

  // Observer for viewport visibility (0% margin)
  const visibleObserverRef = useRef<IntersectionObserver | null>(null);

  // Observer for nearby/preload zone
  const nearbyObserverRef = useRef<IntersectionObserver | null>(null);

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };

    checkMobile();

    const mediaQuery = window.matchMedia('(max-width: 768px)');
    mediaQuery.addEventListener('change', checkMobile);

    return () => {
      mediaQuery.removeEventListener('change', checkMobile);
    };
  }, []);

  // Pending updates to batch process during idle time
  const pendingUpdatesRef = useRef<Map<Element, { entry: IntersectionObserverEntry; zone: 'visible' | 'nearby' }>>(new Map());
  const idleCallbackRef = useRef<number | ReturnType<typeof setTimeout>>(0);

  // Process batched updates during idle time to avoid scroll jank
  const flushPendingUpdates = useCallback(() => {
    const updates = pendingUpdatesRef.current;
    if (updates.size === 0) return;

    // Process all pending updates in a single batch
    updates.forEach(({ entry, zone }, element) => {
      const callback = callbacksRef.current.get(element);
      if (callback) {
        callback(entry, zone);
      }
    });
    updates.clear();
  }, []);

  const scheduleFlush = useCallback(() => {
    if (idleCallbackRef.current) {
      cancelIdleCallbackPolyfill(idleCallbackRef.current as number);
    }
    // Use requestIdleCallback to process updates when browser is idle
    // With a timeout to ensure updates happen within reasonable time
    idleCallbackRef.current = requestIdleCallbackPolyfill(flushPendingUpdates, { timeout: 100 });
  }, [flushPendingUpdates]);

  // Create observers when mobile state changes
  useEffect(() => {
    const threshold = isMobile ? THRESHOLDS.mobile : THRESHOLDS.desktop;

    // Observer for direct visibility
    visibleObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Batch the update instead of processing immediately
          const existing = pendingUpdatesRef.current.get(entry.target);
          // Visible zone takes priority, so only update if not already set to visible
          if (!existing || existing.zone !== 'visible') {
            pendingUpdatesRef.current.set(entry.target, { entry, zone: 'visible' });
          } else {
            // Update the entry but keep the zone
            pendingUpdatesRef.current.set(entry.target, { entry, zone: 'visible' });
          }
        });
        scheduleFlush();
      },
      {
        rootMargin: '0px',
        threshold: 0,
      }
    );

    // Observer for nearby zone (preloading)
    nearbyObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Only set nearby if there's no pending visible update
          const existing = pendingUpdatesRef.current.get(entry.target);
          if (!existing || existing.zone !== 'visible') {
            pendingUpdatesRef.current.set(entry.target, { entry, zone: 'nearby' });
          }
        });
        scheduleFlush();
      },
      {
        rootMargin: `${threshold.nearby} 0px`,
        threshold: 0,
      }
    );

    // Re-observe all elements with new observers
    callbacksRef.current.forEach((_, element) => {
      visibleObserverRef.current?.observe(element);
      nearbyObserverRef.current?.observe(element);
    });

    return () => {
      visibleObserverRef.current?.disconnect();
      nearbyObserverRef.current?.disconnect();
      if (idleCallbackRef.current) {
        cancelIdleCallbackPolyfill(idleCallbackRef.current as number);
      }
    };
  }, [isMobile, scheduleFlush]);

  const observe = useCallback((element: Element, callback: IntersectionCallback) => {
    callbacksRef.current.set(element, callback);
    visibleObserverRef.current?.observe(element);
    nearbyObserverRef.current?.observe(element);
  }, []);

  const unobserve = useCallback((element: Element) => {
    callbacksRef.current.delete(element);
    visibleObserverRef.current?.unobserve(element);
    nearbyObserverRef.current?.unobserve(element);
  }, []);

  return (
    <MediaObserverContext.Provider value={{ observe, unobserve, isMobile }}>
      {children}
    </MediaObserverContext.Provider>
  );
}

export function useMediaObserver(): MediaObserverContextValue {
  const context = useContext(MediaObserverContext);
  if (!context) {
    throw new Error('useMediaObserver must be used within a MediaObserverProvider');
  }
  return context;
}
