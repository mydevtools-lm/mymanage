import "server-only";
import "./node-db";
import { runRoute } from "./api-routes";

/**
 * Turns an api-routes.ts entry into Next route handlers. Each route file is
 * one line: `export const { GET, PATCH } = route("/api/tasks/:id")`.
 * Importing node-db makes node:sqlite the database for repo.ts.
 */

type Context = { params: Promise<Record<string, string>> };
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function handler(method: Method, pattern: string) {
  return async (request: Request, context?: Context) => {
    const params = (await context?.params) ?? {};
    const body = method === "GET" ? undefined : await readJson(request);
    const { status, body: answer } = await runRoute(
      method,
      pattern,
      params,
      body,
    );
    return Response.json(answer, { status });
  };
}

export function route(pattern: string) {
  return {
    GET: handler("GET", pattern),
    POST: handler("POST", pattern),
    PUT: handler("PUT", pattern),
    PATCH: handler("PATCH", pattern),
    DELETE: handler("DELETE", pattern),
  };
}
