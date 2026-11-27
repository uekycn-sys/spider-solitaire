import { useEffect, useState } from 'react';

export interface ViewportMode {
  width: number;
  height: number;
  isCompactLandscape: boolean;
  isMobilePortrait: boolean;
  isMobile: boolean;
  fullscreenSupported: boolean;
}

function readViewport(): ViewportMode {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      height: 800,
      isCompactLandscape: false,
      isMobilePortrait: false,
      isMobile: false,
      fullscreenSupported: false,
    };
  }

  const width = Math.round(window.visualViewport?.width ?? window.innerWidth);
  const height = Math.round(window.visualViewport?.height ?? window.innerHeight);
  const isCompactLandscape = height <= 500 && width > height;
  const isMobilePortrait = width < 640 && height >= width;
  const fullscreenSupported =
    typeof document !== 'undefined' &&
    Boolean(
      document.fullscreenEnabled &&
        typeof document.documentElement?.requestFullscreen === 'function'
    );

  return {
    width,
    height,
    isCompactLandscape,
    isMobilePortrait,
    isMobile: isCompactLandscape || isMobilePortrait,
    fullscreenSupported,
  };
}

export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(readViewport);

  useEffect(() => {
    const update = () => {
      const next = readViewport();
      setMode((prev) =>
        prev.width === next.width &&
        prev.height === next.height &&
        prev.isCompactLandscape === next.isCompactLandscape &&
        prev.isMobilePortrait === next.isMobilePortrait &&
        prev.fullscreenSupported === next.fullscreenSupported
          ? prev
          : next
      );
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return mode;
}
