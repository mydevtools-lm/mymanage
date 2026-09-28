import { deleteRoutine, updateRoutine } from "@/lib/repo";
import { badRequest, handle, notFound, readJson, ok } from "@/lib/api-helpers";
import type { Routine } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<Partial<Routine>>(request);
  if (!body) return badRequest("גוף הבקשה אינו JSON תקין");
  const updated = updateRoutine(id, body);
  return updated ? ok(updated) : notFound();
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return handle(() => {
    deleteRoutine(id);
    return { ok: true };
  });
}
