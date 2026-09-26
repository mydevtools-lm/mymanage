import { listTransactions, createTransaction } from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";
import type { Transaction } from "@/lib/types";

export async function GET() {
  return handle(() => listTransactions());
}

export async function POST(request: Request) {
  const body = await readJson<Partial<Transaction>>(request);
  if (!body) return badRequest("גוף הבקשה אינו JSON תקין");
  return handle(() => createTransaction(body));
}
