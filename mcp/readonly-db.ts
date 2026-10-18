import { existsSync } from "node:fs";
import path from "node:path";
import type { Db, SqlValue } from "../src/lib/db-adapter";

/**
 * The app's database, opened for reading only (ד9). SQLite itself refuses
 * every write on this connection, so nothing in this process can change the
 * data — whatever a tool, a bug or a client asks for.
 *
 * Opening a database in WAL mode may create its `-shm` side file next to it;
 * the database file itself is never touched.
 */

/** The installed app keeps its data here (src-tauri/tauri.conf.json). */
const APP_IDENTIFIER = "io.github.mydevtools-lm.management";

type Env = Record<string, string | undefined>;

export function defaultDbPath(env: Env = process.env): string | null {
  if (!env.APPDATA) return null;
  return path.join(env.APPDATA, APP_IDENTIFIER, "data.db");
}

export function resolveDbPath(
  flag: string | undefined,
  env: Env = process.env,
): string {
  const chosen = flag || env.MYMANAGE_DB || defaultDbPath(env);
  if (!chosen) {
    throw new Error(
      "No database given. Pass --db <path to data.db> or set MYMANAGE_DB.",
    );
  }
  if (!existsSync(chosen)) {
    throw new Error(
      `No database at ${chosen}. Open mymanage once so it creates one, or pass --db <path to data.db>.`,
    );
  }
  return chosen;
}

const READ_ONLY = "This server only reads: it never changes mymanage's data.";

export type ReadOnlyDb = Db & { close(): void };

export async function openReadOnly(file: string): Promise<ReadOnlyDb> {
  let sqlite: typeof import("node:sqlite");
  try {
    sqlite = await import("node:sqlite");
  } catch {
    throw new Error(
      "This Node has no built-in SQLite. Use Node 22 or later, and on Node 22 before 22.13 start it with --experimental-sqlite.",
    );
  }
  const database = new sqlite.DatabaseSync(file, { readOnly: true });
  return {
    close: () => database.close(),
    async all<T>(sql: string, params: SqlValue[] = []) {
      return database.prepare(sql).all(...params) as T[];
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      return (database.prepare(sql).get(...params) ?? null) as T | null;
    },
    async run() {
      throw new Error(READ_ONLY);
    },
    async batch() {
      throw new Error(READ_ONLY);
    },
  };
}
