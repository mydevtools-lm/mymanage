import { format, parseISO, isValid } from "date-fns";
import { he } from "date-fns/locale";

const currency = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number) {
  return currency.format(amount);
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

export function formatDate(key: string, pattern = "d בMMM yyyy") {
  return format(parseDateKey(key), pattern, { locale: he });
}

export function formatMonth(monthKey: string) {
  return format(parseISO(`${monthKey}-01`), "MMMM yyyy", { locale: he });
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
