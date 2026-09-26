import { updateCategory, deleteCategory } from "@/lib/repo";
import { badRequest, handle, notFound, ok, readJson } from "@/lib/api-helpers";
import type { Category } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<Partial<Category>>(request);
  if (!body) return badRequest("גוף הבקשה אינו JSON תקין");
  const updated = updateCategory(id, body);
  return updated ? ok(updated) : notFound();
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return handle(() => {
    deleteCategory(id);
    return { ok: true };
  });
}
