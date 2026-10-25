import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { SyncFolder } from "./types";

/**
 * A shared folder on this computer's disk, for the tests and for anything
 * running under Node. Like the desktop app's, a file appears under its name
 * only when it is whole: written beside it, then renamed.
 */
export function nodeFolder(root: string): SyncFolder {
  const at = (p: string) => path.join(root, ...p.split("/").filter(Boolean));
  return {
    async list(dir) {
      try {
        return await readdir(at(dir));
      } catch {
        return [];
      }
    },
    async read(file) {
      try {
        return await readFile(at(file), "utf8");
      } catch {
        return null;
      }
    },
    async write(file, text) {
      const target = at(file);
      await mkdir(path.dirname(target), { recursive: true });
      const temporary = `${target}.tmp-${Math.random().toString(36).slice(2)}`;
      await writeFile(temporary, text, "utf8");
      await rename(temporary, target);
    },
    async remove(file) {
      await rm(at(file), { force: true });
    },
  };
}
