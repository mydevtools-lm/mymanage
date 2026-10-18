import "server-only";
import { t } from "./i18n";

/**
 * Thin wrappers shared by the CRUD route handlers, so each route file stays
 * a few lines and every failure comes back in the same shape.
 */

export function ok(data: unknown) {
  return Response.json(data);
}

export function notFound() {
  return Response.json({ error: t().data.api.notFound }, { status: 404 });
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export async function handle<T>(fn: () => T | Promise<T>) {
  try {
    return ok(await fn());
  } catch (error) {
    console.error("API error:", error);
    return Response.json({ error: t().data.api.serverFailed }, { status: 500 });
  }
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
