import {
  getCalendarPrefs,
  setBudgets,
  setCalendarPrefs,
  setPrefs,
} from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";
import type { Settings } from "@/lib/types";

const isObject = (value: unknown) =>
  typeof value === "object" && value !== null;

/**
 * Body: { calendars } — colour and visibility per Google calendar, merged in;
 * { budgets } — every monthly budget, replacing the old set; and/or
 * { prefs } — preferences, merged in (null clears one).
 */
export async function PATCH(request: Request) {
  const body = await readJson<Partial<Settings>>(request);
  const { calendars, budgets, prefs } = body ?? {};
  if (!isObject(calendars) && !isObject(budgets) && !isObject(prefs)) {
    return badRequest("אין מה לעדכן");
  }
  return handle(() => ({
    calendars: calendars
      ? setCalendarPrefs({ ...getCalendarPrefs(), ...calendars })
      : getCalendarPrefs(),
    ...(budgets ? { budgets: setBudgets(budgets) } : {}),
    ...(prefs ? { prefs: setPrefs({ ...prefs }) } : {}),
  }));
}
