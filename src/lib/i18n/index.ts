import { enUS, he as heDates } from "date-fns/locale";
import { MESSAGES, type Messages } from "./messages";

/**
 * The interface language (DESKTOP.md ה6, sprint ד7): English or Hebrew.
 *
 * `t()` returns the messages of the current language, anywhere — in a
 * component, an event handler, the store or an API route. Components may
 * read it during render because <Providers> renders the app only on the
 * client and keys it by the language: switching languages renders every
 * screen again, so nothing keeps a stale text.
 *
 * Never call `t()` at module level; a module-level constant would freeze the
 * language it was first read in.
 */

export type Locale = "en" | "he";
export type { Messages };

export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "he", label: "עברית" },
];

/** Before the page knows better (and on the server without a header). */
export const DEFAULT_LOCALE: Locale = "en";

/** Device preferences live under this key (device-prefs.ts); the language too. */
const DEVICE_KEY = "lior-device";

export const isLocale = (value: unknown): value is Locale =>
  value === "en" || value === "he";

/** Windows' (or the browser's) language: Hebrew if it is Hebrew, else English. */
export function systemLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  return /^(he|iw)\b/i.test(navigator.language) ? "he" : "en";
}

/** The language chosen on this device, if one was. */
export function chosenLocale(): Locale | null {
  try {
    const value = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? "{}").language;
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

/** The browser mode's server before a page says otherwise (`x-locale`) —
 *  `LIOR_LOCALE` lets the tests seed a Hebrew database. */
function serverLocale(): Locale {
  const value =
    typeof process === "undefined" ? undefined : process.env.LIOR_LOCALE;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

let current: Locale =
  typeof window === "undefined"
    ? serverLocale()
    : (chosenLocale() ?? systemLocale());
const listeners = new Set<() => void>();

export const getLocale = () => current;

export const dirOf = (locale: Locale): "rtl" | "ltr" =>
  locale === "he" ? "rtl" : "ltr";

/** Language and direction of the page itself. */
function applyToDocument() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = current;
  document.documentElement.dir = dirOf(current);
}

/** Switch the language now. Saving the choice is device-prefs.ts's job. */
export function setLocale(next: Locale) {
  if (next === current) return;
  current = next;
  applyToDocument();
  for (const listener of listeners) listener();
}

/** Calls `listener` whenever the language changes; returns the unsubscribe.
 *  Components use `useLocale()` (use-locale.ts). */
export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The messages of the current language. */
export function t(locale: Locale = current): Messages {
  return MESSAGES[locale];
}

/** date-fns locale for `format(…, { locale: dateLocale() })`. */
export const dateLocale = (locale: Locale = current) =>
  locale === "he" ? heDates : enUS;

/** BCP 47 tag for Intl (numbers, currency). */
export const intlLocale = (locale: Locale = current) =>
  locale === "he" ? "he-IL" : "en-US";

/**
 * Runs in <head> before the page paints: sets the language and direction
 * from the saved choice or the system language, so a Hebrew screen never
 * flashes left to right. Same rules as above, written out for a plain script.
 */
export const LOCALE_SCRIPT = `try{var l;try{l=JSON.parse(localStorage.getItem(${JSON.stringify(
  DEVICE_KEY,
)})||"{}").language}catch(e){}if(l!=="he"&&l!=="en")l=/^(he|iw)\\b/i.test(navigator.language)?"he":"en";document.documentElement.lang=l;document.documentElement.dir=l==="he"?"rtl":"ltr"}catch(e){}`;

/**
 * On the server: answer in the language the page sent (`x-locale`). One
 * person, one browser — setting it per request is enough.
 */
export function applyRequestLocale(request: Request) {
  const locale = request.headers.get("x-locale");
  if (isLocale(locale)) setLocale(locale);
}
