// Events pulled from Google are read-only, so they get their own look — a
// tinted chip with a leading bar rather than the local category colours.
export const GOOGLE_CHIP =
  "border-s-2 border-s-sky-500 bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100";

export const TASK_CHIP_OPEN =
  "border border-dashed border-primary/40 text-foreground";
export const TASK_CHIP_DONE =
  "border border-dashed text-muted-foreground line-through";

export function timeRange(start?: string, end?: string) {
  if (!start) return "";
  return end ? `${start}–${end}` : start;
}
