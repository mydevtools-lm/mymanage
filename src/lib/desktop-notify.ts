"use client";

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

/**
 * A Windows notification from the desktop app, through the notification
 * plugin — the web Notification API doesn't reach Windows from WebView2.
 * Asks once if needed; false when it can't be shown.
 */
export async function desktopNotify(title: string, body: string) {
  let granted = await isPermissionGranted();
  if (!granted) granted = (await requestPermission()) === "granted";
  if (!granted) return false;
  sendNotification({ title, body });
  return true;
}

/** Whether Windows will show the app's notifications. */
export const desktopNotifyAllowed = () => isPermissionGranted();
