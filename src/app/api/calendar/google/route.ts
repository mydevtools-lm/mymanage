import { fetchGoogleCalendars, isConfigured } from "@/lib/google-calendar";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  if (!DATE_KEY.test(from) || !DATE_KEY.test(to) || from > to) {
    return Response.json(
      {
        configured: isConfigured(),
        calendars: [],
        events: [],
        error: "טווח תאריכים לא תקין",
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
        error: "לא הצלחנו לקרוא את היומן מגוגל. בדוק את הכתובת ב-.env.local",
      },
      { status: 502 },
    );
  }
  return Response.json({
    configured: true,
    calendars,
    events,
    error: failed.length
      ? `לא הצלחנו לקרוא את: ${failed.map((c) => c.name).join(", ")}`
      : undefined,
  });
}
