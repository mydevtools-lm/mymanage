import { getNote, updateNote, deleteNote } from "@/lib/repo";
import { badRequest, handle, notFound, readJson, ok } from "@/lib/api-helpers";
import type { Note } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const found = getNote(id);
  return found ? ok(found) : notFound();
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<Partial<Note>>(request);
  if (!body) return badRequest("גוף הבקשה אינו JSON תקין");
  const updated = updateNote(id, body);
  return updated ? ok(updated) : notFound();
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return handle(() => {
    deleteNote(id);
    return { ok: true };
  });
}
