import {
  renameChecklist,
  deleteChecklist,
  clearDoneChecklistItems,
  addChecklistItem,
  setChecklistPinned,
  resetChecklist,
  reorderChecklistItems,
} from "@/lib/repo";
import { badRequest, handle, notFound, ok, readJson } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{
    title?: string;
    addItem?: string;
    addItemId?: string;
    addItemIndex?: number | null;
    addItemDone?: boolean | null;
    clearDone?: boolean;
    resetDone?: boolean;
    pinned?: boolean;
    order?: string[];
  }>(request);
  if (!body) return badRequest("גוף הבקשה אינו JSON תקין");

  let list = null;
  if (body.title?.trim()) list = renameChecklist(id, body.title.trim());
  if (body.addItem?.trim()) {
    list = addChecklistItem(id, body.addItem.trim(), body.addItemId, {
      index: body.addItemIndex ?? undefined,
      done: body.addItemDone ?? undefined,
    });
  }
  if (body.clearDone) list = clearDoneChecklistItems(id);
  if (body.resetDone) list = resetChecklist(id);
  if (typeof body.pinned === "boolean") {
    list = setChecklistPinned(id, body.pinned);
  }
  if (Array.isArray(body.order)) list = reorderChecklistItems(id, body.order);

  return list ? ok(list) : notFound();
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return handle(() => {
    deleteChecklist(id);
    return { ok: true };
  });
}
