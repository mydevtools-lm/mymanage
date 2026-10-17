"use client";

import { useDevicePrefs } from "./device-prefs";
import { getLocale, type Locale } from "./i18n";
import { DEFAULT_CATEGORY_SET } from "./schema";
import { useAppStore } from "./store";

/**
 * Switch the interface language (first run, settings › preferences). Saved
 * on this device; default categories still under their name in the other
 * language are renamed — the ones the person renamed keep their names.
 */
export function switchLanguage(next: Locale) {
  const previous = getLocale();
  useDevicePrefs.getState().setLanguage(next);
  if (next === previous) return;
  const { categories, updateCategory } = useAppStore.getState();
  for (const category of categories) {
    const known = DEFAULT_CATEGORY_SET.find(
      (d) => d.kind === category.kind && d[previous] === category.name,
    );
    if (known) updateCategory(category.id, { name: known[next] });
  }
}
