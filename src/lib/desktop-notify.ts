"use client";

import { invoke } from "@tauri-apps/api/core";

/**
 * A Windows notification from the desktop app. Rust shows it (shell.rs) —
 * the web Notification API doesn't reach Windows from WebView2, and the page
 * holds no notification permissions of its own. Windows decides whether it
 * appears (Settings › System › Notifications).
 */
export function desktopNotify(title: string, body: string) {
  return invoke("shell_notify", { title, body });
}
