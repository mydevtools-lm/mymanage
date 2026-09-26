import { fetchGoogleEvents, isConfigured } from "@/lib/google-calendar";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  if (!DATE_KEY.test(from) || !DATE_KEY.test(to) || from > to) {
    return Response.json(
      { configured: isConfigured(), events: [], error: "טווח תאריכים לא תקין" },
      { status: 400 },
    );
  }

  if (!isConfigured()) {
    return Response.json({ configured: false, events: [] });
  }

  try {
    const events = await fetchGoogleEvents(from, to);
    return Response.json({ configured: true, events });
  } catch (error) {
    // The address itself is a secret, so it never appears in the message.
    console.error("Google Calendar fetch failed:", error);
    return Response.json(
      {
        configured: true,
        events: [],
        error: "לא הצלחנו לקרוא את היומן מגוגל. בדוק את הכתובת ב-.env.local",
      },
      { status: 502 },
    );
  }
}
