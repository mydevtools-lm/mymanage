"use client";

import { invoke } from "@tauri-apps/api/core";
import type { Db, SqlValue, Statement } from "./db-adapter";
import { localMonthKey, newId } from "./keys";
import { BASE_SCHEMA, DEFAULT_CATEGORIES, MIGRATIONS } from "./schema";

/**
 * repo.ts in the desktop app: the same SQLite schema as the server, reached
 * through the Rust bridge in src-tauri/src/db.rs instead of node:sqlite.
 */
export const tauriDb: Db = {
  all: <T>(sql: string, params: SqlValue[] = []) =>
    invoke<T[]>("db_all", { sql, params }),
  get: async <T>(sql: string, params: SqlValue[] = []) =>
    (await invoke<T[]>("db_all", { sql, params }))[0] ?? null,
  run: async (sql: string, params: SqlValue[] = []) => {
    await invoke("db_run", { sql, params });
  },
  batch: async (statements: Statement[]) => {
    await invoke("db_batch", { statements });
  },
};

let ready: Promise<void> | null = null;

/** Schema, migrations and first-run defaults — once per app start, the same
 *  steps db.ts takes on the server. */
export function openLocalDb() {
  ready ??= (async () => {
    await invoke("db_exec", { sql: BASE_SCHEMA });
    const { user_version } = (await tauriDb.get<{ user_version: number }>(
      "PRAGMA user_version",
    ))!;
    for (let version = user_version; version < MIGRATIONS.length; version++) {
      await tauriDb.batch([
        { sql: MIGRATIONS[version] },
        { sql: `PRAGMA user_version = ${version + 1}` },
      ]);
    }

    const { n } = (await tauriDb.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM categories",
    ))!;
    if (n === 0) {
      await tauriDb.batch(
        DEFAULT_CATEGORIES.map(([name, color, kind]) => ({
          sql: "INSERT INTO categories (id, name, color, kind) VALUES (?, ?, ?, ?)",
          params: [newId(), name, color, kind],
        })),
      );
    }
    await tauriDb.run(
      "INSERT OR IGNORE INTO settings (key, value) VALUES ('startMonth', ?)",
      [localMonthKey()],
    );
  })();
  return ready;
}
