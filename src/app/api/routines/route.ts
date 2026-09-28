import { createRoutine, ensureRoutineCopies, listRoutines } from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";
import type { Routine } from "@/lib/types";

export async function GET() {
  return handle(() => listRoutines());
}

/** Creates the routine and, if it falls today, today's copy with it. */
export async function POST(request: Request) {
  const body = await readJson<Partial<Routine>>(request);
  if (!body?.title || !body.repeat) return badRequest("חסרים כותרת או תדירות");
  // Which day was last copied is the server's to decide; a client that
  // sends it along would stop today's copy from being made.
  const fields = { ...body, lastDate: undefined };
  return handle(() => {
    const routine = createRoutine(fields);
    ensureRoutineCopies();
    return routine;
  });
}
