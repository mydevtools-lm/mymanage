import { getLocale, type Locale } from "./i18n";
/**
 * The database schema, shared by every place that opens the database: the
 * Node server (db.ts, through node:sqlite) and the desktop app (through the
 * Rust bridge). Plain strings only — nothing here may import a runtime.
 */

export const BASE_SCHEMA = `
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
export const MIGRATIONS: string[] = [
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
  // v5 — recurring events: the rule and end day, and per-day changes (JSON).
  `ALTER TABLE events ADD COLUMN repeat TEXT;
   ALTER TABLE events ADD COLUMN until TEXT;
   ALTER TABLE events ADD COLUMN exceptions TEXT;`,
  // v6 — links between any two items (a task and the event it prepares, the
  // payment that settled a bill…). Undirected; stored once.
  `CREATE TABLE links (
     id        TEXT PRIMARY KEY,
     aKind     TEXT NOT NULL,
     aId       TEXT NOT NULL,
     bKind     TEXT NOT NULL,
     bId       TEXT NOT NULL,
     createdAt TEXT NOT NULL
   );
   CREATE INDEX links_a ON links(aId);
   CREATE INDEX links_b ON links(bId);`,
  // v7 — reminders: minutes before a task's or an event's time.
  `ALTER TABLE tasks ADD COLUMN reminder INTEGER;
   ALTER TABLE events ADD COLUMN reminder INTEGER;`,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/**
 * The categories a new database starts with, named in both languages. A new
 * database gets the names of the language of the moment; after a switch,
 * defaults nobody renamed follow it (language.ts).
 */
export const DEFAULT_CATEGORY_SET: {
  en: string;
  he: string;
  color: string;
  kind: "task" | "finance";
}[] = [
  { en: "Work", he: "עבודה", color: "teal", kind: "task" },
  { en: "Home", he: "בית", color: "amber", kind: "task" },
  { en: "Personal", he: "אישי", color: "lavender", kind: "task" },
  { en: "Studies", he: "לימודים", color: "sky", kind: "task" },
  { en: "Salary", he: "משכורת", color: "mint", kind: "finance" },
  { en: "Other income", he: "הכנסה נוספת", color: "teal", kind: "finance" },
  {
    en: "Rent / mortgage",
    he: "שכירות / משכנתא",
    color: "coral",
    kind: "finance",
  },
  { en: "Food", he: "אוכל", color: "amber", kind: "finance" },
  { en: "Transport", he: "תחבורה", color: "sky", kind: "finance" },
  { en: "Bills", he: "חשבונות", color: "rose", kind: "finance" },
  { en: "Going out", he: "בילויים", color: "lavender", kind: "finance" },
  { en: "Other", he: "אחר", color: "slate", kind: "finance" },
];

/** [name, colour, kind] in the given language (default: the current one). */
export function defaultCategories(
  locale: Locale = getLocale(),
): [string, string, "task" | "finance"][] {
  return DEFAULT_CATEGORY_SET.map((c) => [c[locale], c.color, c.kind]);
}
