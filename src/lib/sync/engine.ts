import type { Db, SqlValue, Statement } from "../db-adapter";
import {
  decodeFile,
  encodeFile,
  entryFromRow,
  parseName,
  segName,
  snapName,
  SYNC_DIR,
  type OutRow,
} from "./files";
import { ALIVE, SYNC_REFERENCES, SYNC_TABLES } from "./tables";
import type {
  Entry,
  Op,
  Scalar,
  SyncFolder,
  SyncOptions,
  SyncResult,
  SyncStatus,
} from "./types";

/**
 * The sync engine (sprint ד8): turns this computer's changes into files in a
 * shared folder, and other computers' files into changes here.
 *
 * It never decides who is right by looking at files, only by stamps. Every
 * field has a stamp — the logical time of its last write and the computer
 * that made it — and the later stamp wins, field by field; so changes to
 * different fields of one row both survive, a deleted row stays deleted
 * unless it is created again afterwards, and applying the same changes twice,
 * or in another order, gives the same result.
 */

const TABLES = new Map(SYNC_TABLES.map((t) => [t.name, t]));

/** Columns a row can't be created without (they have no default). A change
 *  that lacks one is dropped rather than failing the whole merge. */
const REQUIRED: Record<string, string[]> = {
  categories: ["name", "color", "kind"],
  tasks: ["title", "createdAt", "updatedAt"],
  events: ["title", "date", "createdAt"],
  transactions: ["type", "amount", "description", "date", "createdAt"],
  notes: ["title", "createdAt", "updatedAt"],
  checklists: ["title", "createdAt", "updatedAt"],
  checklist_items: ["listId", "text"],
  routines: ["title", "repeat", "startDate", "createdAt", "updatedAt"],
  links: ["aKind", "aId", "bKind", "bId", "createdAt"],
  settings: ["value"],
};

const PENDING_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const PENDING_MAX_TRIES = 5;

/* ------------------------------------------------------------------ meta */

async function meta(db: Db, k: string): Promise<string | null> {
  const row = await db.get<{ v: string }>(
    "SELECT v FROM _sync_meta WHERE k = ?",
    [k],
  );
  return row?.v ?? null;
}

const setMeta = (k: string, v: string | number): Statement => ({
  sql: "INSERT OR REPLACE INTO _sync_meta (k, v) VALUES (?, ?)",
  params: [k, String(v)],
});

const bump = (l: number): Statement => ({
  sql: "UPDATE _sync_meta SET v = CAST(MAX(CAST(v AS INTEGER), ?) AS TEXT) WHERE k = 'l'",
  params: [l],
});

export async function syncStatus(db: Db): Promise<SyncStatus> {
  const on = (await meta(db, "on")) === "1";
  if (!on) {
    return {
      on,
      device: null,
      outbox: 0,
      pending: 0,
      lastSync: null,
      devices: 0,
      deviceNames: [],
    };
  }
  const count = async (sql: string) =>
    (await db.get<{ n: number }>(sql))?.n ?? 0;
  const last = await meta(db, "lastSync");
  return {
    on,
    device: await meta(db, "dev"),
    outbox: await count("SELECT COUNT(*) AS n FROM _sync_out"),
    pending: await count("SELECT COUNT(*) AS n FROM _sync_pending"),
    lastSync: last ? Number(last) : null,
    devices: Number((await meta(db, "devices")) ?? 0),
    deviceNames: JSON.parse((await meta(db, "deviceNames")) ?? "[]"),
  };
}

/* ------------------------------------------------------- turning it on */

const timeOf = (row: Record<string, Scalar>) => {
  const t = Date.parse(String(row.updatedAt ?? row.createdAt ?? ""));
  return Number.isFinite(t) ? t : 0;
};

async function chunked(db: Db, statements: Statement[], size = 400) {
  for (let i = 0; i < statements.length; i += size) {
    await db.batch(statements.slice(i, i + size));
  }
}

/**
 * Starts watching this database and puts everything already in it into the
 * outbox, so the other computers get it. Each row is stamped with the time it
 * was last changed, not with now: a copy that was exported from another
 * computer then loses to that computer's newer edits instead of undoing them.
 * Returns this computer's id.
 */
export async function enableSync(
  db: Db,
  now: () => number = Date.now,
): Promise<string> {
  if ((await meta(db, "on")) === "1") return (await meta(db, "dev"))!;
  const dev = (await meta(db, "dev")) ?? crypto.randomUUID();
  await db.batch([
    { sql: "DELETE FROM _sync_out" },
    // A computer's numbering starts at 1: readers wait for a missing file
    // rather than skip it, so a later start must not carry on from an old one.
    { sql: "DELETE FROM sqlite_sequence WHERE name = '_sync_out'" },
    { sql: "DELETE FROM _sync_field" },
    setMeta("dev", dev),
  ]);

  let high = Math.max(Number((await meta(db, "l")) ?? 0), now());
  for (const table of SYNC_TABLES) {
    const rows = await db.all<Record<string, Scalar>>(
      `SELECT * FROM ${table.name}`,
    );
    const statements: Statement[] = [];
    for (const row of rows) {
      const r = String(row[table.key]);
      const l = timeOf(row);
      high = Math.max(high, l);
      const vals: Record<string, Scalar> = {};
      for (const c of table.columns) vals[c] = row[c] ?? null;
      statements.push({
        sql: "INSERT INTO _sync_out (op, t, r, c, v, l) VALUES ('ins', ?, ?, NULL, ?, ?)",
        params: [table.name, r, JSON.stringify(vals), l],
      });
      for (const c of [ALIVE, ...table.columns]) {
        statements.push({
          sql: "INSERT OR REPLACE INTO _sync_field (t, r, c, l, dev, x) VALUES (?, ?, ?, ?, ?, 1)",
          params: [table.name, r, c, l, dev],
        });
      }
    }
    await chunked(db, statements);
  }
  await db.batch([setMeta("l", high), setMeta("on", 1)]);
  return dev;
}

/** Stops watching and forgets the bookkeeping. The shared folder is left as
 *  it is: the other computers keep using it. */
export async function disableSync(db: Db) {
  await db.batch([
    setMeta("on", 0),
    { sql: "DELETE FROM _sync_out" },
    { sql: "DELETE FROM sqlite_sequence WHERE name = '_sync_out'" },
    { sql: "DELETE FROM _sync_field" },
    { sql: "DELETE FROM _sync_pending" },
    { sql: "DELETE FROM _sync_alias" },
    {
      sql: "DELETE FROM _sync_meta WHERE k NOT IN ('on', 'apply', 'l', 'now')",
    },
  ]);
}

/* ---------------------------------------------------------------- export */

async function exportOut(
  db: Db,
  folder: SyncFolder,
  dev: string,
): Promise<number> {
  const rows = await db.all<OutRow>(
    "SELECT seq, op, t, r, c, v, l FROM _sync_out ORDER BY seq",
  );
  if (rows.length === 0) return 0;
  const from = rows[0].seq;
  const to = rows[rows.length - 1].seq;
  const entries = rows.map((row) => entryFromRow(row, dev));
  await folder.write(
    `${SYNC_DIR}/${dev}/${segName(from, to)}`,
    await encodeFile(dev, "seg", from, to, entries),
  );
  // Only now, with the file whole in the folder, is the outbox let go.
  await db.batch([
    { sql: "DELETE FROM _sync_out WHERE seq <= ?", params: [to] },
    setMeta("exported", to),
  ]);
  return rows.length;
}

/**
 * This computer's state up to the last exported change, as one file: for
 * every row and field this computer wrote last, its current value and stamp.
 * With it written, the older files are no longer needed.
 */
async function compact(db: Db, folder: SyncFolder, dev: string) {
  const to = Number((await meta(db, "exported")) ?? 0);
  if (to === 0) return false;

  const stamps = await db.all<{
    t: string;
    r: string;
    c: string;
    l: number;
    x: number;
  }>("SELECT t, r, c, l, x FROM _sync_field WHERE dev = ?", [dev]);

  const byRow = new Map<string, typeof stamps>();
  for (const s of stamps) {
    const k = `${s.t}\u0001${s.r}`;
    byRow.set(k, [...(byRow.get(k) ?? []), s]);
  }

  const entries: Entry[] = [];
  const add = (e: Op) => entries.push({ ...e, dev, seq: to } as Entry);

  for (const [, fields] of byRow) {
    const { t, r } = fields[0];
    const table = TABLES.get(t);
    if (!table) continue;
    const marker = fields.find((f) => f.c === ALIVE);
    if (marker && marker.x === 0) {
      add({ op: "del", t, r, l: marker.l });
      continue;
    }
    const row = await db.get<Record<string, Scalar>>(
      `SELECT * FROM ${t} WHERE ${table.key} = ?`,
      [r],
    );
    if (!row) continue;
    if (marker) {
      const vals: Record<string, Scalar> = {};
      for (const c of table.columns) vals[c] = row[c] ?? null;
      add({ op: "ins", t, r, l: marker.l, vals });
    }
    for (const f of fields) {
      if (f.c === ALIVE || !table.columns.includes(f.c)) continue;
      if (marker && f.l <= marker.l) continue;
      add({ op: "set", t, r, c: f.c, v: row[f.c] ?? null, l: f.l });
    }
  }

  const name = snapName(to);
  await folder.write(
    `${SYNC_DIR}/${dev}/${name}`,
    await encodeFile(dev, "snap", 0, to, entries),
  );
  // The older files go only after the new one is in place.
  for (const file of await folder.list(`${SYNC_DIR}/${dev}`)) {
    const parsed = parseName(file);
    if (parsed && parsed.name !== name && parsed.to <= to) {
      await folder.remove(`${SYNC_DIR}/${dev}/${file}`);
    }
  }
  return true;
}

/* ---------------------------------------------------------------- import */

interface Incoming {
  entries: Entry[];
  /** cursor per computer after these are applied */
  cursors: Map<string, number>;
  waiting: string[];
  devices: number;
  names: string[];
}

async function readOthers(
  db: Db,
  folder: SyncFolder,
  me: string,
): Promise<Incoming> {
  const incoming: Incoming = {
    entries: [],
    cursors: new Map(),
    waiting: [],
    devices: 0,
    names: [],
  };
  for (const dev of await folder.list(SYNC_DIR)) {
    if (dev === me || dev.includes(".") || dev.includes("/")) continue;
    const names = (await folder.list(`${SYNC_DIR}/${dev}`))
      .map(parseName)
      .filter((n): n is NonNullable<typeof n> => n !== null);
    if (names.length === 0) continue;
    incoming.devices++;
    try {
      const info = JSON.parse(
        (await folder.read(`${SYNC_DIR}/${dev}/device.json`)) ?? "{}",
      );
      if (typeof info.name === "string" && info.name) {
        incoming.names.push(info.name);
      }
    } catch {
      // No name: it is listed as another computer.
    }

    let cursor = Number((await meta(db, `cur:${dev}`)) ?? 0);

    // A snapshot newer than where we are replaces the files it covers.
    const snaps = names
      .filter((n) => n.kind === "snap")
      .sort((a, b) => b.to - a.to);
    for (const snap of snaps) {
      if (snap.to <= cursor) break;
      const file = await decodeFile(
        await folder.read(`${SYNC_DIR}/${dev}/${snap.name}`),
        dev,
      );
      if (!file) {
        incoming.waiting.push(`${dev}/${snap.name}`);
        continue;
      }
      incoming.entries.push(...file.entries);
      cursor = snap.to;
      break;
    }

    const segs = names
      .filter((n) => n.kind === "seg" && n.to > cursor)
      .sort((a, b) => a.from - b.from);
    for (const seg of segs) {
      if (seg.from > cursor + 1) {
        // A file in between hasn't arrived; going on would skip changes.
        incoming.waiting.push(`${dev}/${segName(cursor + 1, seg.from - 1)}`);
        break;
      }
      const file = await decodeFile(
        await folder.read(`${SYNC_DIR}/${dev}/${seg.name}`),
        dev,
      );
      if (!file) {
        incoming.waiting.push(`${dev}/${seg.name}`);
        break;
      }
      incoming.entries.push(...file.entries.filter((e) => e.seq > cursor));
      cursor = Math.max(cursor, seg.to);
    }
    incoming.cursors.set(dev, cursor);
  }
  return incoming;
}

/* ----------------------------------------------------------------- apply */

interface Stamp {
  l: number;
  dev: string;
  x: number;
}

const stampKey = (t: string, r: string, c: string) =>
  `${t}\u0001${r}\u0001${c}`;

/** `a` is later than `b`: by logical time, and between equal times by the
 *  computer's id, so every computer settles ties the same way. */
const later = (a: { l: number; dev: string }, b?: { l: number; dev: string }) =>
  !b || a.l > b.l || (a.l === b.l && a.dev > b.dev);

interface Pending {
  entry: Entry;
  seen: number;
  tries: number;
}

const byTime = (a: Entry, b: Entry) =>
  a.l - b.l || (a.dev < b.dev ? -1 : a.dev > b.dev ? 1 : 0) || a.seq - b.seq;

async function loadIn<T>(
  db: Db,
  sql: (marks: string) => string,
  ids: string[],
  extra: SqlValue[] = [],
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const part = ids.slice(i, i + 300);
    out.push(
      ...(await db.all<T>(sql(part.map(() => "?").join(",")), [
        ...extra,
        ...part,
      ])),
    );
  }
  return out;
}

const isRecord = (v: unknown): v is Record<string, Scalar> =>
  typeof v === "object" && v !== null;

/**
 * Applies other computers' changes in one transaction. Returns how many did
 * something, how many wait for something else, and whether this database
 * changed. `extra` statements (the read positions) go in the same
 * transaction, so a position never moves past changes that were not applied.
 */
async function applyBatch(
  db: Db,
  incoming: Pending[],
  now: number,
  extra: Statement[],
  replacePending: boolean,
): Promise<{ applied: number; pending: number; changed: boolean }> {
  const todo = [...incoming].sort((a, b) => byTime(a.entry, b.entry));

  /* ---- categories made on two computers are one category ---- */
  const aliases = new Map<string, string>();
  for (const a of await db.all<{ t: string; remote: string; local: string }>(
    "SELECT t, remote, local FROM _sync_alias",
  )) {
    aliases.set(`${a.t}\u0001${a.remote}`, a.local);
  }
  const newAliases: { remote: string; local: string }[] = [];
  const cats = await db.all<{ id: string; kind: string; name: string }>(
    "SELECT id, kind, name FROM categories",
  );
  const hasLocal = new Set(cats.map((c) => c.id));
  for (const p of todo) {
    const e = p.entry;
    if (e.t !== "categories") continue;
    const known = aliases.get(`categories\u0001${e.r}`);
    if (known) {
      e.r = known;
      continue;
    }
    if (e.op !== "ins" || hasLocal.has(e.r)) continue;
    const twin = cats.find(
      (c) => c.kind === e.vals.kind && c.name === e.vals.name && c.id !== e.r,
    );
    if (twin) {
      aliases.set(`categories\u0001${e.r}`, twin.id);
      newAliases.push({ remote: e.r, local: twin.id });
      e.r = twin.id;
    } else {
      // Will exist once applied; a second computer's copy joins it.
      cats.push({
        id: e.r,
        kind: String(e.vals.kind),
        name: String(e.vals.name),
      });
    }
  }
  const mapCategory = (v: Scalar): Scalar =>
    typeof v === "string" ? (aliases.get(`categories\u0001${v}`) ?? v) : v;
  const remapBudgets = (value: Scalar): Scalar => {
    if (typeof value !== "string") return value;
    try {
      const parsed = JSON.parse(value);
      if (!isRecord(parsed)) return value;
      const mapped: Record<string, Scalar> = {};
      for (const [id, amount] of Object.entries(parsed)) {
        mapped[String(mapCategory(id))] = amount as Scalar;
      }
      return JSON.stringify(mapped);
    } catch {
      return value;
    }
  };
  const refOf = new Map<string, (typeof SYNC_REFERENCES)[number]>(
    SYNC_REFERENCES.map((ref) => [`${ref.table}\u0001${ref.column}`, ref]),
  );

  /* ---- what is here now ---- */
  const wanted = new Map<string, Set<string>>();
  const want = (t: string, r: string) => {
    if (!wanted.has(t)) wanted.set(t, new Set());
    wanted.get(t)!.add(r);
  };
  for (const { entry: e } of todo) {
    want(e.t, e.r);
    const vals = e.op === "ins" ? e.vals : e.op === "set" ? { [e.c]: e.v } : {};
    for (const [c, v] of Object.entries(vals)) {
      const ref = refOf.get(`${e.t}\u0001${c}`);
      if (ref && typeof v === "string") {
        want(
          ref.parent,
          ref.parent === "categories" ? String(mapCategory(v)) : v,
        );
      }
    }
  }
  const rows = new Map<string, Set<string>>();
  const stamps = new Map<string, Stamp>();
  for (const [t, ids] of wanted) {
    const table = TABLES.get(t);
    if (!table) continue;
    const list = [...ids];
    rows.set(
      t,
      new Set(
        (
          await loadIn<{ k: string }>(
            db,
            (m) =>
              `SELECT ${table.key} AS k FROM ${t} WHERE ${table.key} IN (${m})`,
            list,
          )
        ).map((x) => x.k),
      ),
    );
    for (const s of await loadIn<{
      r: string;
      c: string;
      l: number;
      dev: string;
      x: number;
    }>(
      db,
      (m) =>
        `SELECT r, c, l, dev, x FROM _sync_field WHERE t = ? AND r IN (${m})`,
      list,
      [t],
    )) {
      stamps.set(stampKey(t, s.r, s.c), { l: s.l, dev: s.dev, x: s.x });
    }
  }
  const exists = (t: string, r: string) => rows.get(t)?.has(r) ?? false;

  /* ---- the changes ---- */
  const writes: Statement[] = [];
  const touched = new Map<
    string,
    Stamp & { t: string; r: string; c: string }
  >();
  const stampOf = (t: string, r: string, c: string) =>
    stamps.get(stampKey(t, r, c));
  const stamp = (e: Entry, c: string, x = 1) => {
    const s = { l: e.l, dev: e.dev, x };
    stamps.set(stampKey(e.t, e.r, c), s);
    touched.set(stampKey(e.t, e.r, c), { ...s, t: e.t, r: e.r, c });
  };
  const parentState = (parent: string, id: string) => {
    if (exists(parent, id)) return "present" as const;
    return stampOf(parent, id, ALIVE)?.x === 0
      ? ("dead" as const)
      : ("unknown" as const);
  };

  /** A value for a column, after the category alias and the check that the
   *  row it points at is there. "wait" and "drop" end the change. */
  const resolve = (
    t: string,
    c: string,
    v: Scalar,
  ): { v: Scalar } | "wait" | "drop" => {
    let value = v;
    if (t === "settings" && c === "value") return { v };
    const ref = refOf.get(`${t}\u0001${c}`);
    if (ref && typeof value === "string") {
      if (ref.parent === "categories") value = mapCategory(value);
      const state = parentState(ref.parent, String(value));
      if (state === "unknown") return "wait";
      if (state === "dead")
        return ref.onParentGone === "null" ? { v: null } : "drop";
    }
    return { v: value };
  };

  let applied = 0;
  let changed = false;
  const unresolved: Pending[] = [];
  const insert = (
    t: string,
    key: string,
    r: string,
    cols: Record<string, Scalar>,
  ) => {
    const names = Object.keys(cols);
    writes.push({
      sql: `INSERT INTO ${t} (${[key, ...names].join(", ")}) VALUES (${[r, ...names].map(() => "?").join(", ")})`,
      params: [r, ...names.map((n) => cols[n])],
    });
    changed = true;
  };
  const update = (
    t: string,
    key: string,
    r: string,
    cols: Record<string, Scalar>,
  ) => {
    const names = Object.keys(cols);
    if (names.length === 0) return;
    writes.push({
      sql: `UPDATE ${t} SET ${names.map((n) => `${n} = ?`).join(", ")} WHERE ${key} = ?`,
      params: [...names.map((n) => cols[n]), r],
    });
    changed = true;
  };

  for (const p of todo) {
    const e = p.entry;
    const table = TABLES.get(e.t);
    if (!table) continue; // from a newer version of the app: not ours to keep
    const marker = stampOf(e.t, e.r, ALIVE);

    if (e.op === "del") {
      if (marker && !later(e, marker)) continue;
      stamp(e, ALIVE, 0);
      if (exists(e.t, e.r)) {
        writes.push({
          sql: `DELETE FROM ${e.t} WHERE ${table.key} = ?`,
          params: [e.r],
        });
        rows.get(e.t)!.delete(e.r);
        changed = true;
      }
      applied++;
      continue;
    }

    if (e.op === "set") {
      if (!table.columns.includes(e.c)) continue;
      if (!exists(e.t, e.r)) {
        if (marker?.x === 0) continue; // deleted: the change has nothing to land on
        unresolved.push(p);
        continue;
      }
      const current = stampOf(e.t, e.r, e.c);
      if (current && !later(e, current)) continue;
      const got = resolve(e.t, e.c, e.v);
      if (got === "wait") {
        unresolved.push(p);
        continue;
      }
      if (got === "drop") continue;
      const value =
        e.t === "settings" && e.r === "budgets" ? remapBudgets(got.v) : got.v;
      update(e.t, table.key, e.r, { [e.c]: value });
      stamp(e, e.c);
      applied++;
      continue;
    }

    // ins
    if (marker?.x === 0 && !later(e, marker)) continue; // deleted after this
    const required = REQUIRED[e.t] ?? [];
    if (required.some((c) => e.vals[c] === undefined || e.vals[c] === null))
      continue;
    const known: Record<string, Scalar> = {};
    let waiting = false;
    let dropped = false;
    for (const c of table.columns) {
      if (!(c in e.vals)) continue;
      const got = resolve(e.t, c, e.vals[c]);
      if (got === "wait") waiting = true;
      else if (got === "drop") dropped = true;
      else known[c] = got.v;
    }
    if (dropped) continue;
    if (waiting) {
      unresolved.push(p);
      continue;
    }
    if (e.t === "settings" && e.r === "budgets" && "value" in known) {
      known.value = remapBudgets(known.value);
    }

    if (!exists(e.t, e.r)) {
      insert(e.t, table.key, e.r, known);
      const present = rows.get(e.t);
      if (present) present.add(e.r);
      else rows.set(e.t, new Set([e.r]));
      stamp(e, ALIVE);
      for (const c of Object.keys(known)) stamp(e, c);
    } else {
      const fresh: Record<string, Scalar> = {};
      for (const [c, v] of Object.entries(known)) {
        if (later(e, stampOf(e.t, e.r, c))) {
          fresh[c] = v;
          stamp(e, c);
        }
      }
      update(e.t, table.key, e.r, fresh);
      if (later(e, marker)) stamp(e, ALIVE);
    }
    applied++;
  }

  /* ---- put it together ---- */
  const statements: Statement[] = [setMeta("apply", 1), ...writes];
  for (const s of touched.values()) {
    statements.push({
      sql: "INSERT OR REPLACE INTO _sync_field (t, r, c, l, dev, x) VALUES (?, ?, ?, ?, ?, ?)",
      params: [s.t, s.r, s.c, s.l, s.dev, s.x],
    });
  }
  for (const a of newAliases) {
    statements.push({
      sql: "INSERT OR REPLACE INTO _sync_alias (t, remote, local) VALUES ('categories', ?, ?)",
      params: [a.remote, a.local],
    });
  }
  if (replacePending) statements.push({ sql: "DELETE FROM _sync_pending" });
  let kept = 0;
  for (const p of unresolved) {
    if (now - p.seen > PENDING_MAX_AGE || p.tries >= PENDING_MAX_TRIES)
      continue;
    kept++;
    statements.push({
      sql: "INSERT INTO _sync_pending (dev, seq, seen, tries, entry) VALUES (?, ?, ?, ?, ?)",
      params: [
        p.entry.dev,
        p.entry.seq,
        p.seen,
        p.tries,
        JSON.stringify(p.entry),
      ],
    });
  }
  const high = todo.reduce((m, p) => Math.max(m, p.entry.l), 0);
  statements.push(bump(high), ...extra, setMeta("apply", 0));
  await db.batch(statements);
  return { applied, pending: kept, changed };
}

async function applyEntries(
  db: Db,
  entries: Entry[],
  now: number,
  extra: Statement[],
): Promise<{ applied: number; pending: number; changed: boolean }> {
  const stored = await db.all<{
    seen: number;
    tries: number;
    entry: string;
  }>("SELECT seen, tries, entry FROM _sync_pending");
  const all: Pending[] = [
    ...stored.map((s) => ({
      entry: JSON.parse(s.entry) as Entry,
      seen: s.seen,
      tries: s.tries + 1,
    })),
    ...entries.map((entry) => ({ entry, seen: now, tries: 0 })),
  ];

  try {
    return await applyBatch(db, all, now, extra, true);
  } catch {
    // Something in the batch the database refuses. Take the changes one at a
    // time, so one bad change can't hold back the others.
  }
  await db.batch([{ sql: "DELETE FROM _sync_pending" }]);
  let applied = 0;
  let changed = false;
  for (const p of all) {
    try {
      const r = await applyBatch(db, [p], now, [], false);
      applied += r.applied;
      changed ||= r.changed;
    } catch {
      if (p.tries + 1 < PENDING_MAX_TRIES) {
        await db.run(
          "INSERT INTO _sync_pending (dev, seq, seen, tries, entry) VALUES (?, ?, ?, ?, ?)",
          [
            p.entry.dev,
            p.entry.seq,
            p.seen,
            p.tries + 1,
            JSON.stringify(p.entry),
          ],
        );
      }
    }
  }
  if (extra.length) await db.batch(extra);
  const pending =
    (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM _sync_pending"))
      ?.n ?? 0;
  return { applied, pending, changed };
}

/* ------------------------------------------------------------- the round */

/**
 * One round of sync: write this computer's changes, read the others', merge,
 * and tidy up. Safe to run as often as you like, and while another computer
 * is mid-upload: it only ever reads whole, checked files.
 */
export async function syncOnce(
  db: Db,
  folder: SyncFolder,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const now = options.now ?? Date.now;
  if ((await meta(db, "on")) !== "1") throw new Error("Sync is off");
  const dev = (await meta(db, "dev"))!;

  const exported = await exportOut(db, folder, dev);
  if ((await folder.read(`${SYNC_DIR}/${dev}/device.json`)) === null) {
    await folder.write(
      `${SYNC_DIR}/${dev}/device.json`,
      JSON.stringify({
        app: "mymanage-sync",
        version: 1,
        dev,
        name: options.deviceName ?? "",
        created: now(),
      }),
    );
  }

  const incoming = await readOthers(db, folder, dev);
  let applied = 0;
  let pending = 0;
  let changed = false;
  const cursors: Statement[] = [...incoming.cursors].map(([d, n]) =>
    setMeta(`cur:${d}`, n),
  );
  const first = (await meta(db, "merged")) !== "1";
  if (incoming.entries.length > 0 || cursors.length > 0) {
    if (first && incoming.entries.length > 0)
      await options.beforeFirstMerge?.();
    const result = await applyEntries(db, incoming.entries, now(), [
      ...cursors,
      setMeta("merged", 1),
    ]);
    applied = result.applied;
    pending = result.pending;
    changed = result.changed;
  } else {
    pending =
      (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM _sync_pending"))
        ?.n ?? 0;
  }

  let compacted = false;
  const own = (await folder.list(`${SYNC_DIR}/${dev}`)).filter((n) =>
    parseName(n),
  );
  if (own.length >= (options.compactAfter ?? 20)) {
    compacted = await compact(db, folder, dev);
  }

  await db.batch([
    setMeta("lastSync", now()),
    setMeta("devices", incoming.devices),
    setMeta("deviceNames", JSON.stringify(incoming.names)),
  ]);
  return {
    exported,
    applied,
    pending,
    devices: incoming.devices,
    deviceNames: incoming.names,
    waiting: incoming.waiting,
    compacted,
    changed,
  };
}
