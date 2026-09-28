import type { ColorKey } from "@/lib/types";

// Events pulled from Google are read-only, so they get their own look — a
// pale tint with a leading bar, rather than the filled local event colours.
// Each Google calendar has its own tint (settings › connections).
const TINTS: Record<
  ColorKey,
  { bar: string; chip: string; card: string; dot: string }
> = {
  teal: {
    bar: "border-s-teal-500",
    chip: "bg-teal-50 text-teal-900 dark:bg-teal-950/50 dark:text-teal-100",
    card: "bg-teal-50/70 dark:bg-teal-950/30",
    dot: "bg-teal-500",
  },
  coral: {
    bar: "border-s-orange-500",
    chip: "bg-orange-50 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100",
    card: "bg-orange-50/70 dark:bg-orange-950/30",
    dot: "bg-orange-500",
  },
  lavender: {
    bar: "border-s-violet-500",
    chip: "bg-violet-50 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100",
    card: "bg-violet-50/70 dark:bg-violet-950/30",
    dot: "bg-violet-500",
  },
  amber: {
    bar: "border-s-amber-500",
    chip: "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
    card: "bg-amber-50/70 dark:bg-amber-950/30",
    dot: "bg-amber-500",
  },
  sky: {
    bar: "border-s-sky-500",
    chip: "bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100",
    card: "bg-sky-50/70 dark:bg-sky-950/30",
    dot: "bg-sky-500",
  },
  mint: {
    bar: "border-s-emerald-500",
    chip: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100",
    card: "bg-emerald-50/70 dark:bg-emerald-950/30",
    dot: "bg-emerald-500",
  },
  rose: {
    bar: "border-s-rose-500",
    chip: "bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100",
    card: "bg-rose-50/70 dark:bg-rose-950/30",
    dot: "bg-rose-500",
  },
  slate: {
    bar: "border-s-slate-500",
    chip: "bg-slate-50 text-slate-900 dark:bg-slate-900/50 dark:text-slate-100",
    card: "bg-slate-50/70 dark:bg-slate-900/30",
    dot: "bg-slate-500",
  },
};

/** Default tints for calendars 1, 2, 3… until one is picked. */
const DEFAULT_TINTS: ColorKey[] = [
  "sky",
  "lavender",
  "amber",
  "mint",
  "rose",
  "coral",
  "teal",
  "slate",
];

export function defaultCalendarColor(calendarId: string): ColorKey {
  const index = (Number(calendarId) || 1) - 1;
  return DEFAULT_TINTS[index % DEFAULT_TINTS.length];
}

export function googleTint(color: ColorKey = "sky") {
  return TINTS[color];
}

/** A small read-only chip: bar, tint and text colour. */
export function googleChip(color: ColorKey = "sky") {
  const t = TINTS[color];
  return `border-s-2 ${t.bar} ${t.chip}`;
}

export const TASK_CHIP_OPEN =
  "border border-dashed border-primary/40 text-foreground";
export const TASK_CHIP_DONE =
  "border border-dashed text-muted-foreground line-through";

export function timeRange(start?: string, end?: string) {
  if (!start) return "";
  return end ? `${start}–${end}` : start;
}
