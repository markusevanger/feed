"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface HeroGlobeContextValue {
  heroVisible: boolean;
  setHeroVisible: (visible: boolean) => void;
}

const HeroGlobeContext = createContext<HeroGlobeContextValue>({
  heroVisible: true,
  setHeroVisible: () => {},
});

export function HeroGlobeProvider({ children }: { children: ReactNode }) {
  const [heroVisible, setHeroVisible] = useState(true);
  return (
    <HeroGlobeContext.Provider value={{ heroVisible, setHeroVisible }}>
      {children}
    </HeroGlobeContext.Provider>
  );
}

export function useHeroGlobe() {
  return useContext(HeroGlobeContext);
}
