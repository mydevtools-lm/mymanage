import {
  getTransaction,
  updateTransaction,
  deleteTransaction,
} from "@/lib/repo";
import { badRequest, handle, notFound, readJson, ok } from "@/lib/api-helpers";
import type { Transaction } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const found = getTransaction(id);
  return found ? ok(found) : notFound();
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<Partial<Transaction>>(request);
  if (!body) return badRequest("גוף הבקשה אינו JSON תקין");
  const updated = updateTransaction(id, body);
  return updated ? ok(updated) : notFound();
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return handle(() => {
    deleteTransaction(id);
    return { ok: true };
  });
}
