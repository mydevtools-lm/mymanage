"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, getLocale, subscribeLocale, type Locale } from ".";

/** The current language, re-rendering when it changes. Client only: the
 *  rest of i18n is imported by the layout and the API routes too. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, () => DEFAULT_LOCALE);
}
