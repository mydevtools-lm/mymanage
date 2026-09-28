"use client";

import { useSyncExternalStore } from "react";

/**
 * Live media-query match. The server has no viewport, so it renders as
 * `serverDefault` and the client corrects it right after hydration.
 */
export function useMediaQuery(query: string, serverDefault = false) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverDefault,
  );
}

/** Tailwind's `md` breakpoint — sidebar and desktop layouts start here. */
export function useIsDesktop() {
  return useMediaQuery("(min-width: 768px)", true);
}
