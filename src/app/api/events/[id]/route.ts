import { getEvent, updateEvent, deleteEvent } from "@/lib/repo";
import { badRequest, handle, notFound, readJson, ok } from "@/lib/api-helpers";
import type { CalendarEvent } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const found = getEvent(id);
  return found ? ok(found) : notFound();
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<Partial<CalendarEvent>>(request);
  if (!body) return badRequest("גוף הבקשה אינו JSON תקין");
  const updated = updateEvent(id, body);
  return updated ? ok(updated) : notFound();
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return handle(() => {
    deleteEvent(id);
    return { ok: true };
  });
}
