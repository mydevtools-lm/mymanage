import { existsSync, lstatSync, readdirSync, statSync } from "node:fs";
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

export type Env = Record<string, string | undefined>;

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

function isSameFolder(a: string, b: string): boolean {
  const [one, other] = [a, b].map((p) => statSync(p, { bigint: true }));
  return one.ino === other.ino && one.dev === other.dev;
}

/**
 * Claude from the Microsoft Store runs in a Windows package, and so does what
 * it starts, this server included. Inside one, %APPDATA% and %LOCALAPPDATA%
 * are a merged view of the real folders and the package's private LocalCache.
 *
 * A real folder with no private twin behaves normally: reads and writes reach
 * the real files, and share them with the open app. But if a private folder of
 * the same name exists (the app was first opened from a chat, say), this
 * process sees that folder. A write goes there and reports success, and the
 * app never sees it. A read answers from a copy that may have nothing to do
 * with the app's data, or misses what the app has only in its WAL.
 *
 * The folder we see and the private one being the same folder tells the two
 * apart, with nothing written and no need to know which package we might be
 * in: from outside the package they are two folders. A junction from the
 * private path to the real folder sends everything to the real files, so it
 * doesn't count, and neither does a --db that names the private path itself.
 *
 * Returns the private folder in use, or null when we reach the real files.
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

/**
 * A check to run before touching the file. Looked up once: it can't change
 * under an open connection, and undoing it takes a restart anyway, since the
 * connection stays on the private file. It throws at the tool call rather than
 * at startup, so the message reaches the chat and not only a log.
 */
export function realFolderCheck(file: string, env: Env = process.env) {
  const privateFolder = privateFolderInUse(file, env);
  return () => {
    if (!privateFolder) return;
    throw new Error(
      `This chat app runs in a Windows package that has a private folder for this data: ${privateFolder}. What it read there could be out of date, and what it wrote would never reach mymanage. Nothing was read or changed. Quit the chat app (from the tray too), rename that folder, and start the chat app again. Whatever was written there before stays in the renamed folder.`,
    );
  };
}

const READ_ONLY = "This server only reads: it never changes mymanage's data.";

export type ReadOnlyDb = Db & { close(): void };

export async function loadSqlite(): Promise<typeof import("node:sqlite")> {
  try {
    return await import("node:sqlite");
  } catch {
    throw new Error(
      "This Node has no built-in SQLite. Use Node 22 or later, and on Node 22 before 22.13 start it with --experimental-sqlite.",
    );
  }
}

export async function openReadOnly(
  file: string,
  env: Env = process.env,
): Promise<ReadOnlyDb> {
  const checkRealFolder = realFolderCheck(file, env);
  const sqlite = await loadSqlite();
  const database = new sqlite.DatabaseSync(file, { readOnly: true });
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
    async run() {
      throw new Error(READ_ONLY);
    },
    async batch() {
      throw new Error(READ_ONLY);
    },
  };
}
