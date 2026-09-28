"use client";

import { create } from "zustand";

/**
 * Preferences that belong to this device rather than to the data: whether
 * the morning brief opens by itself here, which reminders already fired
 * here. Kept in localStorage; a private window simply starts fresh.
 */

const KEY = "lior-device";

interface Stored {
  autoBrief: boolean;
  briefShownOn?: string;
  /** Reminder keys already shown on this device, with the day they fired. */
  fired: Record<string, string>;
}

const DEFAULTS: Stored = { autoBrief: true, fired: {} };

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function write(value: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage blocked: the preference holds for this visit only.
  }
}

interface DevicePrefs extends Stored {
  loaded: boolean;
  load: () => void;
  setAutoBrief: (on: boolean) => void;
  markBriefShown: (day: string) => void;
  markFired: (keys: string[], day: string) => void;
}

export const useDevicePrefs = create<DevicePrefs>()((set, get) => {
  const save = (patch: Partial<Stored>) => {
    const next = { ...get(), ...patch };
    set(patch);
    write({
      autoBrief: next.autoBrief,
      briefShownOn: next.briefShownOn,
      fired: next.fired,
    });
  };
  return {
    ...DEFAULTS,
    loaded: false,
    load: () => set({ ...read(), loaded: true }),
    setAutoBrief: (autoBrief) => save({ autoBrief }),
    markBriefShown: (briefShownOn) => save({ briefShownOn }),
    markFired: (keys, day) => {
      // Keep two days of history; older keys can never fire again anyway.
      const cutoff = new Date(Date.now() - 2 * 86_400_000).toLocaleDateString(
        "sv",
      );
      const fired = Object.fromEntries(
        Object.entries(get().fired).filter(([, d]) => d >= cutoff),
      );
      for (const key of keys) fired[key] = day;
      save({ fired });
    },
  };
});
