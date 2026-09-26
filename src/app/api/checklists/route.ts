import { listChecklists, createChecklist } from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";

export async function GET() {
  return handle(() => listChecklists());
}

export async function POST(request: Request) {
  const body = await readJson<{ title?: string; items?: string[] }>(request);
  if (!body?.title?.trim()) return badRequest("צריך שם לרשימה");
  return handle(() => createChecklist(body.title!.trim(), body.items ?? []));
}
