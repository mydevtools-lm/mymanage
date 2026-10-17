"use client";

import { invoke } from "@tauri-apps/api/core";
import type { Db, SqlValue, Statement } from "./db-adapter";
import { localDateKey, localMonthKey, newId } from "./keys";
import { BASE_SCHEMA, defaultCategories, MIGRATIONS } from "./schema";
import { useDevicePrefs } from "./device-prefs";

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
 *  steps db.ts takes on the server — then the daily backup. */
export async function openLocalDb() {
  ready ??= (async () => {
    await invoke("db_exec", { sql: BASE_SCHEMA });
    const { user_version } = (await tauriDb.get<{ user_version: number }>(
      "PRAGMA user_version",
    ))!;
    // An existing database is copied before it changes shape; a new one has
    // nothing to lose.
    if (user_version > 0 && user_version < MIGRATIONS.length) {
      await invoke("db_backup", {
        label: `${localDateKey()}-before-v${MIGRATIONS.length}`,
      });
    }
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
        defaultCategories().map(([name, color, kind]) => ({
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
  await ready;
  await backupIfDue();
}

let lastBackupDay: string | null = null;

/** One snapshot per calendar day, on the first call of that day — the app
 *  may stay open across midnight, so every call checks. Rust keeps 14, in
 *  the data folder and in the extra folder from settings, if one is set. */
async function backupIfDue(today = localDateKey()) {
  if (lastBackupDay === today) return;
  lastBackupDay = today;
  await backupNow(today);
}

/** Today's snapshot now — also right after an extra folder is picked. */
export function backupNow(today = localDateKey()) {
  const prefs = useDevicePrefs.getState();
  if (!prefs.loaded) prefs.load();
  return invoke<string | null>("db_backup", {
    label: today,
    also: useDevicePrefs.getState().backupDir ?? null,
  });
}
