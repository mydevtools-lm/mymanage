import { getCalendarPrefs, setCalendarPrefs } from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";
import type { Settings } from "@/lib/types";

/** Body: { calendars } — colour and visibility per Google calendar. */
export async function PATCH(request: Request) {
  const body = await readJson<Partial<Settings>>(request);
  if (!body?.calendars || typeof body.calendars !== "object") {
    return badRequest("חסרות העדפות יומנים");
  }
  const calendars = body.calendars;
  return handle(() => ({
    calendars: setCalendarPrefs({ ...getCalendarPrefs(), ...calendars }),
  }));
}
