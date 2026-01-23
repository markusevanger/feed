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

  // Create observers when mobile state changes
  useEffect(() => {
    const threshold = isMobile ? THRESHOLDS.mobile : THRESHOLDS.desktop;

    // Observer for direct visibility
    visibleObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const callback = callbacksRef.current.get(entry.target);
          if (callback) {
            callback(entry, 'visible');
          }
        });
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
          const callback = callbacksRef.current.get(entry.target);
          if (callback) {
            callback(entry, 'nearby');
          }
        });
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
    };
  }, [isMobile]);

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
