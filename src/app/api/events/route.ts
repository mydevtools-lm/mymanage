import { listEvents, createEvent } from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";
import type { CalendarEvent } from "@/lib/types";

export async function GET() {
  return handle(() => listEvents());
}

export async function POST(request: Request) {
  const body = await readJson<Partial<CalendarEvent>>(request);
  if (!body) return badRequest("גוף הבקשה אינו JSON תקין");
  return handle(() => createEvent(body));
}
