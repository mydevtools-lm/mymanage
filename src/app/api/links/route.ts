import { createLink, listLinks } from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";
import type { Link } from "@/lib/types";

const KINDS = ["task", "event", "transaction", "note", "list"];

export async function GET() {
  return handle(() => listLinks());
}

export async function POST(request: Request) {
  const body = await readJson<Partial<Link>>(request);
  if (
    !body?.aId ||
    !body.bId ||
    body.aId === body.bId ||
    !KINDS.includes(body.aKind ?? "") ||
    !KINDS.includes(body.bKind ?? "")
  ) {
    return badRequest("קישור לא תקין");
  }
  return handle(() => createLink(body));
}
