"use client";

import { invoke } from "@tauri-apps/api/core";
import { localDateKey } from "./keys";

/**
 * Updates in the desktop app (src-tauri/src/updates.rs). Rust checks GitHub
 * Releases and installs; the page only asks the person. A build without the
 * project's signing key (every local build) reports updates: false and never
 * finds one.
 */

export interface About {
  version: string;
  /** This build can update itself. */
  updates: boolean;
}

export interface FoundUpdate {
  version: string;
  notes?: string | null;
}

export const appAbout = () => invoke<About>("app_about");

export const checkForUpdate = () => invoke<FoundUpdate | null>("update_check");

/** Backs up the database, then installs; Windows closes and reopens the app. */
export const installUpdateNow = () =>
  invoke("update_install", { today: localDateKey() });

/** Installs the next time the app is quit from the tray. */
export const installUpdateOnExit = () =>
  invoke("update_on_exit", { today: localDateKey() });
