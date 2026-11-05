import { existsSync, lstatSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { Db, SqlValue } from "../src/lib/db-adapter";
import { localDateKey } from "../src/lib/keys";
import { SCHEMA_VERSION } from "../src/lib/schema";
import { loadSqlite } from "./readonly-db";

/**
 * The app's database, opened for writing (ד11, only with --write). The app may
 * be open on the same file, and so may another chat: SQLite's WAL lets them
 * share it, and whoever finds the file busy waits instead of failing.
 *
 * Three checks stand before every write:
 *  - the data folder this process sees is the real one, not a private copy
 *    that only a packaged chat app can see (see privateFolderInUse).
 *  - the file is at the schema this server was built for. The app migrates;
 *    this server never does, and it can outlive an app update.
 *  - the day's backup exists, so a chat's mistake can be undone even when the
 *    app itself was not opened today. It has the name the desktop app gives
 *    its daily backup (src-tauri/src/backup.rs): one file a day, whoever made
 *    it, and the app's own trimming covers it.
 */

const BUSY_WAIT_MS = 5000;

export type WritableDb = Db & { close(): void };

type Env = Record<string, string | undefined>;

function isSameFolder(a: string, b: string): boolean {
  const [one, other] = [a, b].map((p) => statSync(p, { bigint: true }));
  return one.ino === other.ino && one.dev === other.dev;
}

/**
 * Claude from the Microsoft Store runs in a Windows package, and so does what
 * it starts, this server included. Inside one, %APPDATA% and %LOCALAPPDATA%
 * are a merged view of the real folders and the package's private LocalCache.
 *
 * A real folder with no private twin behaves normally: writes reach the real
 * files, and the open app sees them. But if a private folder of the same name
 * exists (the app was first opened from a chat, say), this process sees that
 * folder. A write goes there and reports success, and the app never sees it.
 * With only the WAL landing there, the file itself looks untouched.
 *
 * The folder we see and the private one being the same folder tells the two
 * apart, with nothing written and no need to know which package we might be
 * in: from outside the package they are two folders. A junction from the
 * private path to the real folder sends everything to the real files, so it
 * doesn't count.
 *
 * Returns the private folder in use, or null when writes reach the real files.
 */
export function privateFolderInUse(
  file: string,
  env: Env = process.env,
): string | null {
  if (!env.LOCALAPPDATA) return null;
  const packages = path.join(env.LOCALAPPDATA, "Packages");
  const folder = path.dirname(path.resolve(file));
  for (const [name, root] of [
    ["Roaming", env.APPDATA],
    ["Local", env.LOCALAPPDATA],
  ] as const) {
    if (!root) continue;
    const inside = path.relative(root, folder);
    if (!inside || inside.startsWith("..") || path.isAbsolute(inside)) continue;
    let names: string[];
    try {
      names = readdirSync(packages);
    } catch {
      return null;
    }
    for (const packageName of names) {
      const candidate = path.join(packages, packageName, "LocalCache", name, inside);
      try {
        if (lstatSync(candidate).isSymbolicLink()) continue;
        if (isSameFolder(folder, candidate)) return candidate;
      } catch {
        // No such folder in this package, or one that can't be looked at.
      }
    }
  }
  return null;
}

export async function openWritable(
  file: string,
  env: Env = process.env,
): Promise<WritableDb> {
  const sqlite = await loadSqlite();
  const database = new sqlite.DatabaseSync(file);
  // Per connection, not stored in the file. Foreign keys are what make
  // deleting a category keep its items and deleting a list take its items.
  database.exec(
    `PRAGMA busy_timeout = ${BUSY_WAIT_MS}; PRAGMA foreign_keys = ON;`,
  );

  // Once: it can't change under an open connection, and undoing it takes a
  // restart anyway, since this connection stays on the private file.
  const privateFolder = privateFolderInUse(file, env);
  let backedUpOn: string | null = null;

  function checkRealFolder() {
    if (!privateFolder) return;
    throw new Error(
      `This chat app runs in a Windows package that has a private folder for this data: ${privateFolder}. What it writes would stay there, and mymanage would never see it. Nothing was changed. Quit the chat app (from the tray too), rename that folder, and start the chat app again. Whatever was written there before stays in the renamed folder.`,
    );
  }

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
      return database.prepare(sql).all(...params) as T[];
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
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
