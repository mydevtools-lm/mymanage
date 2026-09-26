import { listNotes, createNote } from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";
import type { Note } from "@/lib/types";

export async function GET() {
  return handle(() => listNotes());
}

export async function POST(request: Request) {
  const body = await readJson<Partial<Note>>(request);
  if (!body) return badRequest("גוף הבקשה אינו JSON תקין");
  return handle(() => createNote(body));
}
