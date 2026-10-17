import { fetchGoogleCalendars, isConfigured } from "@/lib/google-calendar";
import { applyRequestLocale, t } from "@/lib/i18n";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  applyRequestLocale(request);
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  if (!DATE_KEY.test(from) || !DATE_KEY.test(to) || from > to) {
    return Response.json(
      {
        configured: isConfigured(),
        calendars: [],
        events: [],
        error: t().data.calendars.badRange,
      },
      { status: 400 },
    );
  }

  if (!isConfigured()) {
    return Response.json({ configured: false, calendars: [], events: [] });
  }

  // The addresses themselves are secrets, so no message ever includes one.
  const { calendars, events } = await fetchGoogleCalendars(from, to);
  const failed = calendars.filter((c) => c.failed);
  if (failed.length === calendars.length) {
    return Response.json(
      {
        configured: true,
        calendars,
        events: [],
        error: t().data.calendars.allFailedEnv,
      },
      { status: 502 },
    );
  }
  return Response.json({
    configured: true,
    calendars,
    events,
    error: failed.length
      ? t().data.calendars.someFailed(failed.map((c) => c.name))
      : undefined,
  });
}
