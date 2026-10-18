"use client";

import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useQuickAdd } from "@/components/quick-add";
import { useDevicePrefs } from "@/lib/device-prefs";
import { isTauri } from "@/lib/platform";
import { getLocale } from "@/lib/i18n";

/**
 * The desktop app's side of the shell in src-tauri/src/shell.rs: tells Rust
 * whether closing goes to the tray, answers the tray's "new task", and sends
 * links that leave the app to the default browser — the window itself only
 * ever shows the app.
 */
export function DesktopShell() {
  useEffect(() => {
    if (!isTauri()) return;
    const prefs = useDevicePrefs.getState();
    if (!prefs.loaded) prefs.load();
    // The tray menu and Rust's messages follow the page's language. The app
    // re-renders on a switch, so this runs again then.
    void invoke("shell_set_language", { locale: getLocale() });
    void invoke("shell_set_close_to_tray", {
      on: useDevicePrefs.getState().closeToTray !== false,
    });

    const quickAdd = listen("tray-quick-add", () =>
      useQuickAdd.getState().open("task"),
    );

    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin === window.location.origin) return;
      event.preventDefault();
      // Rust opens web addresses only; anything else goes nowhere.
      void invoke("shell_open_url", { url: url.href }).catch(() => {});
    };
    document.addEventListener("click", onClick, true);

    return () => {
      void quickAdd.then((stop) => stop());
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
