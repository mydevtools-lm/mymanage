/**
 * The one database interface repo.ts talks to. Two adapters implement it:
 * node-db.ts (node:sqlite, for the server and the tests) and tauri-db.ts
 * (the Rust bridge, for the desktop app). Whoever runs repo.ts sets the
 * active one first with setRepoDb().
 *
 * There is no open-ended transaction on purpose: in the desktop app every
 * call crosses to Rust, and a BEGIN held across calls would swallow whatever
 * else the screen sends meanwhile. Writes that must land together are
 * collected first and sent as one `batch`.
 */

export type SqlValue = string | number | null;

export interface Statement {
  sql: string;
  /** Without params, `sql` may hold several statements (a script). */
  params?: SqlValue[];
}

export interface Db {
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  /** All of them in one transaction, or none. */
  batch(statements: Statement[]): Promise<void>;
}

let active: Db | null = null;

export function setRepoDb(next: Db) {
  active = next;
}

export function db(): Db {
  if (!active) throw new Error("No database set — call setRepoDb() first");
  return active;
}
