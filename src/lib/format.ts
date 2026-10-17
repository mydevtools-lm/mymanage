import { format, parseISO, isValid } from "date-fns";
import { dateLocale, intlLocale, t } from "./i18n";

let currencyCode = "ILS";
const formatters = new Map<string, Intl.NumberFormat>();

/** Set from the preferences when they load or change. */
export function setCurrency(code: string) {
  currencyCode = code;
}

/** In the currency from the preferences, written the current language's way. */
export function formatCurrency(amount: number) {
  const tag = `${intlLocale()}|${currencyCode}`;
  let formatter = formatters.get(tag);
  if (!formatter) {
    formatter = new Intl.NumberFormat(intlLocale(), {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    });
    formatters.set(tag, formatter);
  }
  return formatter.format(amount);
}

/** The currency's sign alone — ₪, $, € — for a field's adornment. */
export function currencySymbol() {
  return (
    new Intl.NumberFormat(intlLocale(), {
      style: "currency",
      currency: currencyCode,
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currencyCode
  );
}

export function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function toMonthKey(date: Date) {
  return format(date, "yyyy-MM");
}

export function parseDateKey(key: string) {
  const d = parseISO(key);
  return isValid(d) ? d : new Date();
}

/** A day as the screens show it — "14 Oct 2026" / "14 באוק׳ 2026" unless a
 *  pattern is given. */
export function formatDate(key: string, pattern?: string) {
  return format(parseDateKey(key), pattern ?? t().common.dates.short, {
    locale: dateLocale(),
  });
}

export function formatMonth(monthKey: string) {
  return format(parseISO(`${monthKey}-01`), "MMMM yyyy", {
    locale: dateLocale(),
  });
}

/**
 * The local calendar day of an ISO timestamp. Timestamps are stored in UTC,
 * so slicing the first 10 characters puts 01:30 in Israel on the previous day.
 */
export function localDayOf(iso: string) {
  return toDateKey(new Date(iso));
}

export function todayKey() {
  return toDateKey(new Date());
}

export function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
