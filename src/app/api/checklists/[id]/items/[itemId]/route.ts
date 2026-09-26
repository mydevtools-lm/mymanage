import { setChecklistItem, deleteChecklistItem } from "@/lib/repo";
import { badRequest, notFound, ok, readJson } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id, itemId } = await params;
  const body = await readJson<{ text?: string; done?: boolean }>(request);
  if (!body) return badRequest("גוף הבקשה אינו JSON תקין");
  const list = setChecklistItem(id, itemId, body);
  return list ? ok(list) : notFound();
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id, itemId } = await params;
  const list = deleteChecklistItem(id, itemId);
  return list ? ok(list) : notFound();
}
