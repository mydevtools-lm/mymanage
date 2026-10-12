/** True inside the desktop app (Tauri), false in a browser tab. */
export function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
