import { listTasks, createTask } from "@/lib/repo";
import { badRequest, handle, readJson } from "@/lib/api-helpers";
import type { Task } from "@/lib/types";

export async function GET() {
  return handle(() => listTasks());
}

export async function POST(request: Request) {
  const body = await readJson<Partial<Task>>(request);
  if (!body) return badRequest("גוף הבקשה אינו JSON תקין");
  return handle(() => createTask(body));
}
