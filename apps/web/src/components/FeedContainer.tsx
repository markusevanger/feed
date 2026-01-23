'use client';

import { ReactNode } from 'react';
import { MediaObserverProvider } from '@/contexts/MediaObserverContext';

interface FeedContainerProps {
  children: ReactNode;
}

/**
 * Client wrapper that provides the MediaObserverProvider context
 * for image/video deloading optimization.
 */
export function FeedContainer({ children }: FeedContainerProps) {
  return (
    <MediaObserverProvider>
      {children}
    </MediaObserverProvider>
  );
}
