import { readAll, replaceAll, clearAll, ensureRoutineCopies } from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";
import type { DataSnapshot } from "@/lib/types";

/** The whole database in one call — used on app load, on JSON import,
 *  on the one-time migration from localStorage, and on wipe. Loading is also
 *  when today's copies of routines are made. */
export async function GET() {
  return handle(() => {
    ensureRoutineCopies();
    return readAll();
  });
}

export async function PUT(request: Request) {
  const body = await readJson<Partial<DataSnapshot>>(request);
  if (!body || !Array.isArray(body.tasks)) return badRequest("קובץ לא תקין");
  return handle(() => replaceAll(body));
}

export async function DELETE() {
  return handle(() => clearAll());
}
