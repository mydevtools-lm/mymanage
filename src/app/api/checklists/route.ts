import { listChecklists, createChecklist } from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";

export async function GET() {
  return handle(() => listChecklists());
}

export async function POST(request: Request) {
  const body = await readJson<{
    id?: string;
    title?: string;
    items?: (string | { id?: string; text: string })[];
  }>(request);
  const title = body?.title?.trim();
  if (!title) return badRequest("צריך שם לרשימה");
  return handle(() => createChecklist(title, body?.items ?? [], body?.id));
}
