"use client";

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { create } from "zustand";
import { useDevicePrefs } from "../device-prefs";
import { localDateKey } from "../keys";
import { openLocalDb, tauriDb } from "../tauri-db";
import { useAppStore } from "../store";
import { disableSync, enableSync, syncOnce, syncStatus } from "./engine";
import type { SyncFolder, SyncResult, SyncStatus } from "./types";

/**
 * The desktop app's side of syncing (sprint ד8): the chosen folder, when to
 * run a round, and what the Settings › Sync screen shows. The merging itself
 * is engine.ts; the folder is read and written by the Rust commands in
 * src-tauri/src/sync.rs, which only reach inside the chosen folder.
 */

const folder: SyncFolder = {
  list: (dir) => invoke<string[]>("sync_list", { dir }),
  read: (path) => invoke<string | null>("sync_read", { path }),
  write: (path, text) => invoke<void>("sync_write", { path, text }),
  remove: (path) => invoke<void>("sync_remove", { path }),
};

interface SyncState {
  status: SyncStatus | null;
  last: SyncResult | null;
  running: boolean;
  /** What went wrong the last time, in words for a person. */
  error: string | null;
  refresh: () => Promise<void>;
  run: () => Promise<void>;
  choose: () => Promise<boolean>;
  start: (dir: string) => Promise<boolean>;
  stop: () => Promise<void>;
}

const message = (error: unknown) =>
  typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : String(error);

export const useSync = create<SyncState>()((set, get) => ({
  status: null,
  last: null,
  running: false,
  error: null,

  refresh: async () => {
    try {
      await openLocalDb();
      set({ status: await syncStatus(tauriDb) });
    } catch (error) {
      set({ error: message(error) });
    }
  },

  /** One round now. Quietly does nothing while another is running, or when
   *  sync is off. */
  run: async () => {
    const dir = useDevicePrefs.getState().syncDir;
    if (!dir || get().running) return;
    set({ running: true, error: null });
    try {
      await openLocalDb();
      await invoke("sync_set_root", { path: dir });
      const name = await invoke<string>("sync_device_name").catch(() => "");
      const result = await syncOnce(tauriDb, folder, {
        deviceName: name,
        beforeFirstMerge: async () => {
          await invoke("db_backup", {
            label: `${localDateKey()}-before-sync`,
            also: useDevicePrefs.getState().backupDir ?? null,
          });
        },
      });
      // What came in from another computer must show on the screens.
      if (result.changed) await useAppStore.getState().load();
      set({ last: result, status: await syncStatus(tauriDb) });
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ running: false });
    }
  },

  /** Pick the folder and start. False when the picker was closed. */
  choose: async () => {
    const picked = await open({ directory: true });
    if (typeof picked !== "string") return false;
    return get().start(picked);
  },

  /** Start syncing through this folder: this computer's data goes out, the
   *  others' comes in. Also what a folder remembered by the app but not yet
   *  started needs. */
  start: async (dir) => {
    set({ error: null });
    try {
      await openLocalDb();
      // Another folder means a fresh start: this computer is written out again.
      if ((await syncStatus(tauriDb)).on) await disableSync(tauriDb);
      const shown = await invoke<string | null>("sync_set_root", { path: dir });
      useDevicePrefs.getState().setSyncDir(shown ?? dir);
      await enableSync(tauriDb);
    } catch (error) {
      useDevicePrefs.getState().setSyncDir(undefined);
      set({ error: message(error) });
      return false;
    }
    await get().run();
    return true;
  },

  stop: async () => {
    try {
      await openLocalDb();
      await disableSync(tauriDb);
      await invoke("sync_set_root", { path: null });
    } catch (error) {
      set({ error: message(error) });
    }
    useDevicePrefs.getState().setSyncDir(undefined);
    set({ status: await syncStatus(tauriDb).catch(() => null), last: null });
  },
}));

const EVERY = 2 * 60 * 1000;
const SOON = 5 * 1000;

/**
 * Runs a round shortly after the app starts, every couple of minutes, and
 * when the window is put away or comes back — the moments a change is likely
 * to have been made or to be waiting. Nothing happens until a folder is
 * chosen. Returns the way to stop.
 */
export function startAutoSync() {
  const prefs = useDevicePrefs.getState();
  if (!prefs.loaded) prefs.load();
  const go = () => void useSync.getState().run();
  const first = setTimeout(go, SOON);
  const timer = setInterval(go, EVERY);
  const onVisibility = () => go();
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
