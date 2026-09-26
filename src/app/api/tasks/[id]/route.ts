import { getTask, updateTask, deleteTask } from "@/lib/repo";
import { badRequest, handle, notFound, readJson, ok } from "@/lib/api-helpers";
import type { Task } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const found = getTask(id);
  return found ? ok(found) : notFound();
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<Partial<Task>>(request);
  if (!body) return badRequest("גוף הבקשה אינו JSON תקין");
  const updated = updateTask(id, body);
  return updated ? ok(updated) : notFound();
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return handle(() => {
    deleteTask(id);
    return { ok: true };
  });
}
