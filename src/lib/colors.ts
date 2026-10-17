import type { ColorKey } from "./types";
import { t } from "./i18n";

// Static class names so Tailwind can see them at build time. The label is a
// getter: read when shown, in the language of the moment.
export const COLOR_STYLES: Record<
  ColorKey,
  { label: string; dot: string; badge: string; soft: string }
> = {
  teal: {
    get label() {
      return t().data.colors.teal;
    },
    dot: "bg-teal-500",
    badge: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200",
    soft: "bg-teal-50 border-teal-200 dark:bg-teal-950/40 dark:border-teal-800",
  },
  coral: {
    get label() {
      return t().data.colors.coral;
    },
    dot: "bg-orange-400",
    badge:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200",
    soft: "bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800",
  },
  lavender: {
    get label() {
      return t().data.colors.lavender;
    },
    dot: "bg-violet-400",
    badge:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200",
    soft: "bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-800",
  },
  amber: {
    get label() {
      return t().data.colors.amber;
    },
    dot: "bg-amber-400",
    badge:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
    soft: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800",
  },
  sky: {
    get label() {
      return t().data.colors.sky;
    },
    dot: "bg-sky-400",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200",
    soft: "bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800",
  },
  mint: {
    get label() {
      return t().data.colors.mint;
    },
    dot: "bg-emerald-400",
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
    soft: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800",
  },
  rose: {
    get label() {
      return t().data.colors.rose;
    },
    dot: "bg-rose-400",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
    soft: "bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800",
  },
  slate: {
    get label() {
      return t().data.colors.slate;
    },
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    soft: "bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-700",
  },
};

export const COLOR_KEYS = Object.keys(COLOR_STYLES) as ColorKey[];
