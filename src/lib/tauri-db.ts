"use client";

import { invoke } from "@tauri-apps/api/core";
import { BASE_SCHEMA, DEFAULT_CATEGORIES, MIGRATIONS } from "./schema";

/**
 * The desktop app's database: the same SQLite schema as the server, reached
 * through the Rust bridge in src-tauri/src/db.rs instead of node:sqlite.
 */

export type Param = string | number | boolean | null;
export type Row = Record<string, Param>;

export const sql = {
  all: <T = Row>(query: string, params: Param[] = []) =>
    invoke<T[]>("db_all", { sql: query, params }),
  get: async <T = Row>(query: string, params: Param[] = []) =>
    (await invoke<T[]>("db_all", { sql: query, params }))[0] ?? null,
  run: (query: string, params: Param[] = []) =>
    invoke<{ changes: number }>("db_run", { sql: query, params }),
  exec: (script: string) => invoke<void>("db_exec", { sql: script }),
  /** All or nothing, in one transaction. */
  batch: (statements: { sql: string; params?: Param[] }[]) =>
    invoke<number>("db_batch", { statements }),
};

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

let ready: Promise<void> | null = null;

/** Schema, migrations and first-run defaults — once per app start. */
export function openLocalDb() {
  ready ??= (async () => {
    await sql.exec(BASE_SCHEMA);
    const { user_version } = (await sql.get<{ user_version: number }>(
      "PRAGMA user_version",
    ))!;
    for (let version = user_version; version < MIGRATIONS.length; version++) {
      await sql.batch([
        { sql: MIGRATIONS[version] },
        { sql: `PRAGMA user_version = ${version + 1}` },
      ]);
    }

    const { n } = (await sql.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM categories",
    ))!;
    if (n === 0) {
      await sql.batch(
        DEFAULT_CATEGORIES.map(([name, color, kind]) => ({
          sql: "INSERT INTO categories (id, name, color, kind) VALUES (?, ?, ?, ?)",
          params: [crypto.randomUUID(), name, color, kind],
        })),
      );
    }
    await sql.run(
      "INSERT OR IGNORE INTO settings (key, value) VALUES ('startMonth', ?)",
      [monthKey()],
    );
  })();
  return ready;
}
