import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

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

const BASE_SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  color    TEXT NOT NULL,
  kind     TEXT NOT NULL CHECK (kind IN ('task','finance'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  dueDate     TEXT,
  priority    TEXT NOT NULL DEFAULT 'normal',
  categoryId  TEXT REFERENCES categories(id) ON DELETE SET NULL,
  completed   INTEGER NOT NULL DEFAULT 0,
  completedAt TEXT,
  archivedAt  TEXT,
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_due ON tasks(dueDate);
CREATE INDEX IF NOT EXISTS tasks_archived ON tasks(archivedAt);

CREATE TABLE IF NOT EXISTS events (
  id        TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  date      TEXT NOT NULL,
  startTime TEXT,
  endTime   TEXT,
  allDay    INTEGER NOT NULL DEFAULT 0,
  location  TEXT,
  notes     TEXT,
  color     TEXT NOT NULL DEFAULT 'teal',
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_date ON events(date);

CREATE TABLE IF NOT EXISTS transactions (
  id                 TEXT PRIMARY KEY,
  type               TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount             REAL NOT NULL,
  description        TEXT NOT NULL,
  date               TEXT NOT NULL,
  categoryId         TEXT REFERENCES categories(id) ON DELETE SET NULL,
  notes              TEXT,
  recurringStartMonth TEXT,
  recurringEndMonth   TEXT,
  createdAt          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS transactions_date ON transactions(date);

CREATE TABLE IF NOT EXISTS notes (
  id        TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  body      TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checklists (
  id        TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id       TEXT PRIMARY KEY,
  listId   TEXT NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  text     TEXT NOT NULL,
  done     INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS checklist_items_list ON checklist_items(listId);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/**
 * Each entry upgrades the schema by one version. Append only — never edit an
 * entry that has shipped, because existing databases have already run it.
 */
const MIGRATIONS: string[] = [
  // v1 — per-month exceptions for recurring transactions (JSON array).
  `ALTER TABLE transactions ADD COLUMN exceptions TEXT;`,
  // v2 — optional time of day for a task (HH:mm), so it can sit on the
  // Today timeline between events.
  `ALTER TABLE tasks ADD COLUMN dueTime TEXT;`,
  // v3 — pinning for lists and notes, and a colour for notes.
  `ALTER TABLE checklists ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE notes ADD COLUMN color TEXT;`,
  // v4 — routines (tasks that come back by themselves), subtasks as a JSON
  // array, and a hand-picked order among a day's tasks.
  `CREATE TABLE routines (
     id          TEXT PRIMARY KEY,
     title       TEXT NOT NULL,
     description TEXT,
     priority    TEXT NOT NULL DEFAULT 'normal',
     categoryId  TEXT REFERENCES categories(id) ON DELETE SET NULL,
     dueTime     TEXT,
     repeat      TEXT NOT NULL,
     startDate   TEXT NOT NULL,
     lastDate    TEXT,
     paused      INTEGER NOT NULL DEFAULT 0,
     createdAt   TEXT NOT NULL,
     updatedAt   TEXT NOT NULL
   );
   ALTER TABLE tasks ADD COLUMN routineId TEXT;
   ALTER TABLE tasks ADD COLUMN subtasks TEXT;
   ALTER TABLE tasks ADD COLUMN position REAL;
   CREATE INDEX tasks_routine ON tasks(routineId);`,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

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

const DEFAULT_CATEGORIES: [string, string, "task" | "finance"][] = [
  ["עבודה", "teal", "task"],
  ["בית", "amber", "task"],
  ["אישי", "lavender", "task"],
  ["לימודים", "sky", "task"],
  ["משכורת", "mint", "finance"],
  ["הכנסה נוספת", "teal", "finance"],
  ["שכירות / משכנתא", "coral", "finance"],
  ["אוכל", "amber", "finance"],
  ["תחבורה", "sky", "finance"],
  ["חשבונות", "rose", "finance"],
  ["בילויים", "lavender", "finance"],
  ["אחר", "slate", "finance"],
];

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
