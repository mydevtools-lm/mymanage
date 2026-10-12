import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { BASE_SCHEMA, DEFAULT_CATEGORIES, MIGRATIONS } from "./schema";

export { SCHEMA_VERSION } from "./schema";

/**
 * Local SQLite database, stored as a file inside the project.
 *
 * Requires Node's built-in sqlite module, which is still behind a flag —
 * the npm scripts pass --experimental-sqlite via NODE_OPTIONS.
 *
 * Schema changes after the first release go through MIGRATIONS and are
 * tracked with PRAGMA user_version, so an existing data/lior.db is upgraded
 * in place instead of being recreated.
 *
 * LIOR_DB_PATH overrides the file location; tests set it to ":memory:".
 */

const DATA_DIR = path.join(process.cwd(), "data");
const BACKUPS_TO_KEEP = 14;

function dbPath() {
  return process.env.LIOR_DB_PATH || path.join(DATA_DIR, "lior.db");
}

let instance: DatabaseSync | null = null;
let lastBackupDay: string | null = null;

function migrate(db: DatabaseSync) {
  const { user_version: current } = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };

  for (let version = current; version < MIGRATIONS.length; version++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}


export function newId() {
  return crypto.randomUUID();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Local calendar values, not UTC: at 01:00 in Israel on the 1st of the month
// toISOString() still reports the previous month.
export function localMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function localDateKey(date = new Date()) {
  return `${localMonthKey(date)}-${pad(date.getDate())}`;
}

export function seedDefaults(db: DatabaseSync = getDb()) {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM categories").get() as {
    n: number;
  };
  if (n === 0) {
    const insert = db.prepare(
      "INSERT INTO categories (id, name, color, kind) VALUES (?, ?, ?, ?)",
    );
    for (const [name, color, kind] of DEFAULT_CATEGORIES) {
      insert.run(newId(), name, color, kind);
    }
  }

  const startMonth = db
    .prepare("SELECT value FROM settings WHERE key = 'startMonth'")
    .get();
  if (!startMonth) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
      "startMonth",
      localMonthKey(),
    );
  }
}

/**
 * One snapshot per calendar day, taken on the first database access of that
 * day. VACUUM INTO writes a consistent copy even while the app is running.
 */
export function backupIfDue(db: DatabaseSync, today = localDateKey()) {
  const file = dbPath();
  if (file === ":memory:" || lastBackupDay === today) return null;

  // Backups sit next to the database they copy, so a test database in a
  // temp folder never writes into the real data/ directory.
  const backupDir = path.join(path.dirname(file), "backups");
  mkdirSync(backupDir, { recursive: true });
  const target = path.join(backupDir, `lior-${today}.db`);
  if (!existsSync(target)) {
    db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  }
  lastBackupDay = today;

  const snapshots = readdirSync(backupDir)
    .filter((name) => /^lior-\d{4}-\d{2}-\d{2}\.db$/.test(name))
    .sort();
  for (const old of snapshots.slice(0, -BACKUPS_TO_KEEP)) {
    rmSync(path.join(backupDir, old), { force: true });
  }
  return target;
}

export function getDb(): DatabaseSync {
  if (instance) {
    backupIfDue(instance);
    return instance;
  }

  const file = dbPath();
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec(BASE_SCHEMA);
  migrate(db);
  seedDefaults(db);
  instance = db;
  backupIfDue(db);
  return db;
}

/** Test helper: drop the cached connection so the next getDb() starts fresh. */
export function resetDbForTests() {
  instance?.close();
  instance = null;
  lastBackupDay = null;
}
