import {
  renameChecklist,
  deleteChecklist,
  clearDoneChecklistItems,
  addChecklistItem,
} from "@/lib/repo";
import { badRequest, handle, notFound, ok, readJson } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{
    title?: string;
    addItem?: string;
    addItemId?: string;
    clearDone?: boolean;
  }>(request);
  if (!body) return badRequest("גוף הבקשה אינו JSON תקין");

  let list = null;
  if (body.title?.trim()) list = renameChecklist(id, body.title.trim());
  if (body.addItem?.trim()) {
    list = addChecklistItem(id, body.addItem.trim(), body.addItemId);
  }
  if (body.clearDone) list = clearDoneChecklistItems(id);

  return list ? ok(list) : notFound();
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return handle(() => {
    deleteChecklist(id);
    return { ok: true };
  });
}
