import { useEffect } from "react";

/** Keep the installed app at its intended scale while preserving one-finger scroll. */
export function useMobileViewport() {
  useEffect(() => {
    const preventGestureZoom = (event: Event) => event.preventDefault();
    const preventPinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    document.addEventListener("gesturestart", preventGestureZoom, {
      passive: false,
    });
    document.addEventListener("gesturechange", preventGestureZoom, {
      passive: false,
    });
    document.addEventListener("touchmove", preventPinch, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", preventGestureZoom);
      document.removeEventListener("gesturechange", preventGestureZoom);
      document.removeEventListener("touchmove", preventPinch);
    };
  }, []);
}
