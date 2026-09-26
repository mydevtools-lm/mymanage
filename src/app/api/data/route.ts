import { readAll, replaceAll, clearAll } from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";
import type { DataSnapshot } from "@/lib/types";

/** The whole database in one call — used on app load, on JSON import,
 *  on the one-time migration from localStorage, and on wipe. */
export async function GET() {
  return handle(() => readAll());
}

export async function PUT(request: Request) {
  const body = await readJson<Partial<DataSnapshot>>(request);
  if (!body || !Array.isArray(body.tasks)) return badRequest("קובץ לא תקין");
  return handle(() => replaceAll(body));
}

export async function DELETE() {
  return handle(() => clearAll());
}
