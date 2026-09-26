import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Local SQLite database, stored as a file inside the project.
 *
 * Requires Node's built-in sqlite module, which is still behind a flag —
 * the npm scripts pass --experimental-sqlite via NODE_OPTIONS.
 *
 * Everything is keyed by string ids generated on the server so the shapes
 * match what the UI already uses. Lists of sub-rows (checklist items) are
 * stored as their own table rather than JSON so they can be updated in place.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "lior.db");

let instance: DatabaseSync | null = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;
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
      new Date().toISOString().slice(0, 7),
    );
  }
}

export function getDb(): DatabaseSync {
  if (instance) return instance;
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(SCHEMA);
  seedDefaults(db);
  instance = db;
  return db;
}
