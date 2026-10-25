/** Shared types of the sync engine (sprint ד8). Plain, no runtime. */

export type Scalar = string | number | null;

/** One change, as it travels between computers. `l` is the logical time. */
export type Op =
  | { op: "ins"; t: string; r: string; l: number; vals: Record<string, Scalar> }
  | { op: "set"; t: string; r: string; c: string; v: Scalar; l: number }
  | { op: "del"; t: string; r: string; l: number };

/** A change with where it came from: the computer, and its place in that
 *  computer's own sequence. */
export type Entry = Op & { dev: string; seq: number };

/**
 * The shared folder, seen by the engine. Paths are relative and use "/".
 * Whoever implements it must make `write` all-or-nothing: the file appears
 * under its name only when it is complete (write to a temporary name, then
 * rename). The desktop app does that in Rust; tests use a plain folder.
 */
export interface SyncFolder {
  /** The names directly inside `dir`; empty when it doesn't exist. */
  list(dir: string): Promise<string[]>;
  /** The text of a file, or null when there is no such file. */
  read(path: string): Promise<string | null>;
  /** Creates folders as needed; replaces a file of the same name. */
  write(path: string, text: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface SyncOptions {
  /** Called once, before the first time another computer's changes are
   *  merged into this one — a copy of the database to go back to. */
  beforeFirstMerge?: () => Promise<void>;
  /** Milliseconds; the clock the engine reads. Tests replace it. */
  now?: () => number;
  /** Write a snapshot and drop old files once this computer has this many
   *  files of its own (default 20). */
  compactAfter?: number;
}

export interface SyncResult {
  /** Changes this computer wrote to the folder. */
  exported: number;
  /** Changes from other computers that were applied. */
  applied: number;
  /** Changes waiting for something else to arrive. */
  pending: number;
  /** Other computers whose files were seen. */
  devices: number;
  /** Files that are not complete yet (still uploading, or damaged). */
  waiting: string[];
  /** A snapshot was written and old files removed. */
  compacted: boolean;
  /** Whether anything changed here, so the screens should reload. */
  changed: boolean;
}

export interface SyncStatus {
  on: boolean;
  device: string | null;
  /** Changes not yet written to the folder. */
  outbox: number;
  pending: number;
  /** Epoch ms of the last finished sync, or null. */
  lastSync: number | null;
  devices: number;
}
