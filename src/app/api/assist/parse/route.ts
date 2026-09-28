import { claudeConfigured, readProposals } from "@/lib/assist";
import { badRequest, handle, readJson } from "@/lib/api-helpers";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whether Claude reads the text, or the local rules do. */
export async function GET() {
  return Response.json({ claude: claudeConfigured() });
}

/** Body: { text, today } → { source, proposals }. Saves nothing. */
export async function POST(request: Request) {
  const body = await readJson<{ text?: unknown; today?: unknown }>(request);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const today = typeof body?.today === "string" ? body.today : "";
  if (!text || text.length > 2000) return badRequest("צריך טקסט");
  if (!DATE.test(today)) return badRequest("תאריך לא תקין");
  return handle(() => readProposals(text, today));
}
