import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { Db, SqlValue } from "../src/lib/db-adapter";
import { localDateKey } from "../src/lib/keys";
import { SCHEMA_VERSION } from "../src/lib/schema";
import { loadSqlite, realFolderCheck, type Env } from "./readonly-db";

/**
 * The app's database, opened for writing (ד11, only with --write). The app may
 * be open on the same file, and so may another chat: SQLite's WAL lets them
 * share it, and whoever finds the file busy waits instead of failing.
 *
 * The data folder must be the real one, for reading too (realFolderCheck).
 * Two more checks stand before every write:
 *  - the file is at the schema this server was built for. The app migrates;
 *    this server never does, and it can outlive an app update.
 *  - the day's backup exists, so a chat's mistake can be undone even when the
 *    app itself was not opened today. It has the name the desktop app gives
 *    its daily backup (src-tauri/src/backup.rs): one file a day, whoever made
 *    it, and the app's own trimming covers it.
 */

const BUSY_WAIT_MS = 5000;

export type WritableDb = Db & { close(): void };

export async function openWritable(
  file: string,
  env: Env = process.env,
): Promise<WritableDb> {
  const checkRealFolder = realFolderCheck(file, env);
  const sqlite = await loadSqlite();
  const database = new sqlite.DatabaseSync(file);
  // Per connection, not stored in the file. Foreign keys are what make
  // deleting a category keep its items and deleting a list take its items.
  database.exec(
    `PRAGMA busy_timeout = ${BUSY_WAIT_MS}; PRAGMA foreign_keys = ON;`,
  );

  let backedUpOn: string | null = null;

  function checkSchema() {
    const { user_version: version } = database
      .prepare("PRAGMA user_version")
      .get() as { user_version: number };
    if (version < SCHEMA_VERSION) {
      throw new Error(
        `The database is older than this server (v${version}, expected v${SCHEMA_VERSION}). Open mymanage once so it upgrades, then try again. Nothing was changed.`,
      );
    }
    if (version > SCHEMA_VERSION) {
      throw new Error(
        `The database is newer than this server (v${version}, expected v${SCHEMA_VERSION}). Get the mymanage-mcp.mjs of the same release as the app. Nothing was changed.`,
      );
    }
  }

  function backupOnce() {
    const today = localDateKey();
    if (backedUpOn === today) return;
    const folder = path.join(path.dirname(file), "backups");
    const target = path.join(folder, `backup-${today}.db`);
    if (!existsSync(target)) {
      mkdirSync(folder, { recursive: true });
      database.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
    }
    backedUpOn = today;
  }

  function beforeWrite() {
    checkRealFolder();
    checkSchema();
    backupOnce();
  }

  return {
    close: () => database.close(),
    async all<T>(sql: string, params: SqlValue[] = []) {
      checkRealFolder();
      return database.prepare(sql).all(...params) as T[];
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      checkRealFolder();
      return (database.prepare(sql).get(...params) ?? null) as T | null;
    },
    async run(sql: string, params: SqlValue[] = []) {
      beforeWrite();
      database.prepare(sql).run(...params);
    },
    async batch(statements) {
      beforeWrite();
      // IMMEDIATE takes the write lock now, under the busy wait. A plain BEGIN
      // would take it at the first write and could fail there at once if the
      // app wrote in between.
      database.exec("BEGIN IMMEDIATE");
      try {
        for (const { sql, params } of statements) {
          if (params) database.prepare(sql).run(...params);
          else database.exec(sql);
        }
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
