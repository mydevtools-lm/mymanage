/**
 * What is synchronised between computers, and the SQL that watches it
 * (sprint ד8). Plain data and strings only: schema.ts imports this, and
 * schema.ts is shared by every place that opens the database.
 *
 * The idea: while sync is on, SQLite triggers on each table write what
 * changed — a row appearing, a field changing, a row going — into a small
 * outbox (`_sync_out`), stamped with a logical clock, and remember the stamp
 * of every field (`_sync_field`). The code in engine.ts turns the outbox into
 * files in the shared folder, and merges other computers' files back in,
 * field by field: the later stamp wins. Triggers see every write, whoever
 * made it, so repo.ts needs no changes.
 */

export interface SyncTable {
  name: string;
  /** The column that identifies a row. */
  key: string;
  /** Every other column. Keep in step with the schema — see below. */
  columns: string[];
}

/**
 * A test (sync-tables.test.ts) compares these lists with the real columns, so
 * a migration that adds a column fails until it is added here AND the
 * triggers are recreated by a new migration that calls `syncTriggersSql()`.
 */
export const SYNC_TABLES: SyncTable[] = [
  { name: "categories", key: "id", columns: ["name", "color", "kind"] },
  {
    name: "tasks",
    key: "id",
    columns: [
      "title",
      "description",
      "dueDate",
      "priority",
      "categoryId",
      "completed",
      "completedAt",
      "archivedAt",
      "createdAt",
      "updatedAt",
      "dueTime",
      "routineId",
      "subtasks",
      "position",
      "reminder",
    ],
  },
  {
    name: "events",
    key: "id",
    columns: [
      "title",
      "date",
      "startTime",
      "endTime",
      "allDay",
      "location",
      "notes",
      "color",
      "createdAt",
      "repeat",
      "until",
      "exceptions",
      "reminder",
    ],
  },
  {
    name: "transactions",
    key: "id",
    columns: [
      "type",
      "amount",
      "description",
      "date",
      "categoryId",
      "notes",
      "recurringStartMonth",
      "recurringEndMonth",
      "createdAt",
      "exceptions",
    ],
  },
  {
    name: "notes",
    key: "id",
    columns: ["title", "body", "createdAt", "updatedAt", "pinned", "color"],
  },
  {
    name: "checklists",
    key: "id",
    columns: ["title", "createdAt", "updatedAt", "pinned"],
  },
  {
    name: "checklist_items",
    key: "id",
    columns: ["listId", "text", "done", "position"],
  },
  {
    name: "routines",
    key: "id",
    columns: [
      "title",
      "description",
      "priority",
      "categoryId",
      "dueTime",
      "repeat",
      "startDate",
      "lastDate",
      "paused",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    name: "links",
    key: "id",
    columns: ["aKind", "aId", "bKind", "bId", "createdAt"],
  },
  { name: "settings", key: "key", columns: ["value"] },
];

/** Columns that point at another table's row, and what happens to the row
 *  when the parent is gone (the schema's ON DELETE rule). */
export const SYNC_REFERENCES: {
  table: string;
  column: string;
  parent: string;
  onParentGone: "null" | "drop";
}[] = [
  {
    table: "tasks",
    column: "categoryId",
    parent: "categories",
    onParentGone: "null",
  },
  {
    table: "routines",
    column: "categoryId",
    parent: "categories",
    onParentGone: "null",
  },
  {
    table: "transactions",
    column: "categoryId",
    parent: "categories",
    onParentGone: "null",
  },
  {
    table: "checklist_items",
    column: "listId",
    parent: "checklists",
    onParentGone: "drop",
  },
];

/** The marker "field" that says whether a row exists. */
export const ALIVE = "#";

/** The tables that exist only for sync. They hold nothing of the user's. */
export const SYNC_BOOKKEEPING = `
CREATE TABLE IF NOT EXISTS _sync_meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
INSERT OR IGNORE INTO _sync_meta (k, v) VALUES ('on', '0'), ('apply', '0'), ('l', '0');

-- The stamp of every field's current value: the logical time and the device
-- that wrote it. For the marker field '#', x = 0 means the row was deleted.
CREATE TABLE IF NOT EXISTS _sync_field (
  t   TEXT NOT NULL,
  r   TEXT NOT NULL,
  c   TEXT NOT NULL,
  l   INTEGER NOT NULL,
  dev TEXT NOT NULL,
  x   INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (t, r, c)
) WITHOUT ROWID;

-- What this computer changed and has not yet written to the shared folder.
CREATE TABLE IF NOT EXISTS _sync_out (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  op  TEXT NOT NULL,
  t   TEXT NOT NULL,
  r   TEXT NOT NULL,
  c   TEXT,
  v   TEXT,
  l   INTEGER NOT NULL
);

-- Changes from other computers that cannot be applied yet: their row, or the
-- row they point at, has not arrived.
CREATE TABLE IF NOT EXISTS _sync_pending (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  dev  TEXT NOT NULL,
  seq  INTEGER NOT NULL,
  seen INTEGER NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0,
  entry TEXT NOT NULL
);

-- The same category made on two computers is one category: another
-- computer's id, and the id it stands for here.
CREATE TABLE IF NOT EXISTS _sync_alias (
  t      TEXT NOT NULL,
  remote TEXT NOT NULL,
  local  TEXT NOT NULL,
  PRIMARY KEY (t, remote)
) WITHOUT ROWID;
`;

// The clock: wall time in ms, but never behind what this computer has already
// stamped or seen (so a computer with a slow clock still orders after what it
// has read). `now` in _sync_meta is for tests; the app never sets it.
const WALL = `COALESCE((SELECT CAST(v AS INTEGER) FROM _sync_meta WHERE k = 'now'), CAST(strftime('%s', 'now') AS INTEGER) * 1000 + CAST(substr(strftime('%f', 'now'), 4) AS INTEGER))`;
const TICK = `UPDATE _sync_meta SET v = MAX(${WALL}, CAST(v AS INTEGER) + 1) WHERE k = 'l';`;
const L = `(SELECT CAST(v AS INTEGER) FROM _sync_meta WHERE k = 'l')`;
const DEV = `(SELECT v FROM _sync_meta WHERE k = 'dev')`;
const WATCHING = `(SELECT v FROM _sync_meta WHERE k = 'on') = '1' AND (SELECT v FROM _sync_meta WHERE k = 'apply') = '0'`;

const q = (name: string) => `'${name.replace(/'/g, "''")}'`;

function stamp(table: string, rid: string, column: string, alive?: 0 | 1) {
  return `INSERT INTO _sync_field (t, r, c, l, dev, x) VALUES (${q(table)}, ${rid}, ${q(column)}, ${L}, ${DEV}, ${alive ?? 1}) ON CONFLICT (t, r, c) DO UPDATE SET l = excluded.l, dev = excluded.dev, x = excluded.x;`;
}

/** The triggers for every synchronised table. Creating them again replaces
 *  the old ones, so a migration that changes a table calls this once more. */
export function syncTriggersSql(tables: SyncTable[] = SYNC_TABLES): string {
  const out: string[] = [];
  for (const { name, key, columns } of tables) {
    for (const kind of ["ai", "au", "ad"]) {
      out.push(`DROP TRIGGER IF EXISTS _sync_${kind}_${name};`);
    }

    const inserted = `json_object(${columns.map((c) => `${q(c)}, NEW.${c}`).join(", ")})`;
    out.push(`CREATE TRIGGER _sync_ai_${name} AFTER INSERT ON ${name}
WHEN ${WATCHING}
BEGIN
  ${TICK}
  INSERT INTO _sync_out (op, t, r, c, v, l) VALUES ('ins', ${q(name)}, NEW.${key}, NULL, ${inserted}, ${L});
  ${stamp(name, `NEW.${key}`, "#", 1)}
  ${columns.map((c) => stamp(name, `NEW.${key}`, c)).join("\n  ")}
END;`);

    const changed = columns.map(
      (
        c,
      ) => `INSERT INTO _sync_out (op, t, r, c, v, l) SELECT 'set', ${q(name)}, NEW.${key}, ${q(c)}, json_quote(NEW.${c}), ${L} WHERE OLD.${c} IS NOT NEW.${c};
  INSERT INTO _sync_field (t, r, c, l, dev, x) SELECT ${q(name)}, NEW.${key}, ${q(c)}, ${L}, ${DEV}, 1 WHERE OLD.${c} IS NOT NEW.${c} ON CONFLICT (t, r, c) DO UPDATE SET l = excluded.l, dev = excluded.dev, x = excluded.x;`,
    );
    out.push(`CREATE TRIGGER _sync_au_${name} AFTER UPDATE ON ${name}
WHEN ${WATCHING}
BEGIN
  ${TICK}
  ${changed.join("\n  ")}
END;`);

    out.push(`CREATE TRIGGER _sync_ad_${name} AFTER DELETE ON ${name}
WHEN ${WATCHING}
BEGIN
  ${TICK}
  INSERT INTO _sync_out (op, t, r, c, v, l) VALUES ('del', ${q(name)}, OLD.${key}, NULL, NULL, ${L});
  ${stamp(name, `OLD.${key}`, "#", 0)}
END;`);
  }
  return out.join("\n");
}

/** Migration v8: the bookkeeping tables and the triggers. Sync stays off
 *  (`on` = 0) until the person turns it on, so nothing is written meanwhile. */
export function syncMigrationSql() {
  return `${SYNC_BOOKKEEPING}\n${syncTriggersSql()}`;
}
