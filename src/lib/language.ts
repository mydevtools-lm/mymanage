"use client";

import { useDevicePrefs } from "./device-prefs";
import { LOCALES, type Locale } from "./i18n";
import { DEFAULT_CATEGORY_SET } from "./schema";
import { useAppStore } from "./store";

/**
 * Switch the interface language (first run, settings › preferences). Saved
 * on this device. Default categories still under a default name — in either
 * language: the database may have been created in the other one — take the
 * new language's name; the ones the person renamed keep their names.
 */
export function switchLanguage(next: Locale) {
  useDevicePrefs.getState().setLanguage(next);
  const { categories, updateCategory } = useAppStore.getState();
  for (const category of categories) {
    const known = DEFAULT_CATEGORY_SET.find(
      (d) =>
        d.kind === category.kind &&
        LOCALES.some(({ value }) => d[value] === category.name),
    );
    if (known && known[next] !== category.name) {
      updateCategory(category.id, { name: known[next] });
    }
  }
}
