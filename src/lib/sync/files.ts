import type { Entry, Op } from "./types";

/**
 * What goes into the shared folder (sprint ד8):
 *
 *   mymanage-sync/v1/<device>/seg-<from>-<to>.json   changes, once written
 *                                                    never touched again
 *   mymanage-sync/v1/<device>/snap-<to>.json         this computer's state
 *                                                    up to that point; lets
 *                                                    the older files go
 *   mymanage-sync/v1/<device>/device.json            who this is
 *
 * Every computer writes only inside its own folder, and never changes a file
 * it has written, so a cloud drive has nothing to conflict about.
 */

export const SYNC_DIR = "v1";
export const FORMAT = "mymanage-sync";

export interface JournalFile {
  app: typeof FORMAT;
  version: 1;
  dev: string;
  kind: "seg" | "snap";
  from: number;
  to: number;
  /** SHA-256 of JSON.stringify(entries): a half-uploaded file fails it. */
  sha256: string;
  entries: Entry[];
}

const pad = (n: number) => String(n).padStart(10, "0");

export const segName = (from: number, to: number) =>
  `seg-${pad(from)}-${pad(to)}.json`;
export const snapName = (to: number) => `snap-${pad(to)}.json`;

export type FileName =
  | { kind: "seg"; from: number; to: number; name: string }
  | { kind: "snap"; from: number; to: number; name: string };

/** Reads a file name; null for anything else (temporary names included). */
export function parseName(name: string): FileName | null {
  const seg = /^seg-(\d{10})-(\d{10})\.json$/.exec(name);
  if (seg) return { kind: "seg", from: +seg[1], to: +seg[2], name };
  const snap = /^snap-(\d{10})\.json$/.exec(name);
  if (snap) return { kind: "snap", from: 0, to: +snap[1], name };
  return null;
}

export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function encodeFile(
  dev: string,
  kind: "seg" | "snap",
  from: number,
  to: number,
  entries: Entry[],
): Promise<string> {
  const file: JournalFile = {
    app: FORMAT,
    version: 1,
    dev,
    kind,
    from,
    to,
    sha256: await sha256(JSON.stringify(entries)),
    entries,
  };
  return JSON.stringify(file);
}

/** The entries of a file, or null if it is not complete and sound. */
export async function decodeFile(
  text: string | null,
  expectDev: string,
): Promise<JournalFile | null> {
  if (!text) return null;
  try {
    const file = JSON.parse(text) as JournalFile;
    if (file.app !== FORMAT || file.version !== 1) return null;
    if (file.dev !== expectDev || !Array.isArray(file.entries)) return null;
    if ((await sha256(JSON.stringify(file.entries))) !== file.sha256)
      return null;
    return file;
  } catch {
    return null;
  }
}

/** A change as stored in the outbox. */
export interface OutRow {
  seq: number;
  op: "ins" | "set" | "del";
  t: string;
  r: string;
  c: string | null;
  v: string | null;
  l: number;
}

export function entryFromRow(row: OutRow, dev: string): Entry {
  const base = { dev, seq: row.seq, t: row.t, r: row.r, l: row.l };
  if (row.op === "ins") {
    return { ...base, op: "ins", vals: JSON.parse(row.v ?? "{}") };
  }
  if (row.op === "set") {
    return {
      ...base,
      op: "set",
      c: row.c ?? "",
      v: JSON.parse(row.v ?? "null"),
    };
  }
  return { ...base, op: "del" } satisfies Op & { dev: string; seq: number };
}
