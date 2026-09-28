/**
 * JSON.stringify silently drops keys whose value is undefined. For a PATCH
 * that means "clear this field" never reaches the server — the field keeps
 * its old value. Sending null instead makes the intent explicit; the
 * repository stores null as "empty".
 */
export function toJsonBody(body: unknown): string {
  return JSON.stringify(body, (_key, value) =>
    value === undefined ? null : value,
  );
}
