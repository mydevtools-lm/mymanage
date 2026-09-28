import { createTransactions, deleteTransactions } from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";
import type { Transaction } from "@/lib/types";

/** Body: { transactions } — all saved together, or none. */
export async function POST(request: Request) {
  const body = await readJson<{ transactions?: Partial<Transaction>[] }>(
    request,
  );
  if (!Array.isArray(body?.transactions))
    return badRequest("צריך רשימת תנועות");
  const rows = body.transactions;
  return handle(() => createTransactions(rows));
}

/** Body: { ids } — undoing an import. */
export async function DELETE(request: Request) {
  const body = await readJson<{ ids?: unknown }>(request);
  const ids = body?.ids;
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
    return badRequest("צריך רשימת מזהים");
  }
  return handle(() => {
    deleteTransactions(ids);
    return { ok: true };
  });
}
