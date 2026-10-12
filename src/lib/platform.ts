import { useSyncExternalStore } from "react";

/** True inside the desktop app (Tauri), false in a browser tab. */
export function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const never = () => () => {};

/** isTauri() for rendering: false in the pre-rendered HTML, the real answer
 *  once the page runs, so hydration matches. */
export function useIsTauri() {
  return useSyncExternalStore(never, isTauri, () => false);
}
