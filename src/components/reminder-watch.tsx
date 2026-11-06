"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useDevicePrefs } from "@/lib/device-prefs";
import { dueReminders } from "@/lib/brief";
import { todayKey } from "@/lib/format";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/platform";
import { dirOf, getLocale } from "@/lib/i18n";
import { desktopNotify } from "@/lib/desktop-notify";

const CHECK_MS = 30_000;

function notify(title: string, body: string, tag: string) {
  // The desktop app: a Windows notification unless the window is in front —
  // hidden in the tray, minimised or behind another window all count. Rust
  // knows; the page's own visibilityState stays "visible" in the tray.
  if (isTauri()) {
    void invoke<boolean>("shell_in_front")
      .then((front) => (front ? false : desktopNotify(title, body)))
      .catch(() => {});
    return;
  }
  // A system notification when the app is in the background and allowed;
  // on screen a toast is enough.
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted" ||
    document.visibilityState === "visible"
  ) {
    return;
  }
  const options = {
    body,
    tag,
    lang: getLocale(),
    dir: dirOf(getLocale()),
    icon: "/icons/icon-192.png",
  };
  // Phones allow notifications only through the service worker.
  navigator.serviceWorker?.getRegistration().then((registration) => {
    if (registration) {
      void registration.showNotification(title, options);
      return;
    }
    try {
      new Notification(title, options);
    } catch {
      // No worker and no page notifications here: the toast has to do.
    }
  });
}

/**
 * Reminders for tasks and events at their set time, while the app is open,
 * in this tab or in the background. (Push to a closed phone needs FCM: sprint 1.)
 */
export function ReminderWatch() {
  const hydrated = useAppStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    const prefs = useDevicePrefs.getState();
    if (!prefs.loaded) prefs.load();

    const check = () => {
      const { tasks, events } = useAppStore.getState();
      const { fired, markFired } = useDevicePrefs.getState();
      const done = new Set(Object.keys(fired));
      const now = new Date();
      const today = todayKey();
      const shown: string[] = [];

      for (const r of dueReminders({ tasks, events }, now, done)) {
        toast(r.title, {
          description: r.body,
          duration: 60_000,
          icon: <BellRing className="size-4" />,
        });
        notify(r.title, r.body, r.key);
        shown.push(r.key);
      }

      if (shown.length > 0) markFired(shown, today);
    };

    check();
    const timer = setInterval(check, CHECK_MS);
    return () => clearInterval(timer);
  }, [hydrated]);

  return null;
}
