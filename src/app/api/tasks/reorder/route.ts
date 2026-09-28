import { reorderTasks } from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";

/** Body: { ids } — the tasks of one day, in the order they should appear. */
export async function POST(request: Request) {
  const body = await readJson<{ ids?: unknown }>(request);
  const ids = body?.ids;
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
    return badRequest("צריך רשימת מזהים");
  }
  return handle(() => {
    reorderTasks(ids);
    return { ok: true };
  });
}
