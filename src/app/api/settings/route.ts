import { getCalendarPrefs, setBudgets, setCalendarPrefs } from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";
import type { Settings } from "@/lib/types";

/**
 * Body: { calendars } — colour and visibility per Google calendar, merged in;
 * and/or { budgets } — every monthly budget, replacing the old set.
 */
export async function PATCH(request: Request) {
  const body = await readJson<Partial<Settings>>(request);
  const { calendars, budgets } = body ?? {};
  if (
    (calendars === undefined || typeof calendars !== "object") &&
    (budgets === undefined || typeof budgets !== "object")
  ) {
    return badRequest("אין מה לעדכן");
  }
  return handle(() => ({
    calendars: calendars
      ? setCalendarPrefs({ ...getCalendarPrefs(), ...calendars })
      : getCalendarPrefs(),
    ...(budgets ? { budgets: setBudgets(budgets) } : {}),
  }));
}
