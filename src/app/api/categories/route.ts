import { listCategories, createCategory } from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";
import type { Category } from "@/lib/types";

export async function GET() {
  return handle(() => listCategories());
}

export async function POST(request: Request) {
  const body = await readJson<Omit<Category, "id">>(request);
  if (!body?.name || !body.kind) return badRequest("חסר שם או סוג");
  return handle(() => createCategory(body));
}
