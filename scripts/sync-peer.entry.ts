/**
 * A second computer, for the desktop smoke test (scripts/desktop-smoke.mjs,
 * phase "sync"): its own database file, the same shared folder, the same
 * sync engine. Bundled by the smoke script with esbuild; run with
 *   node --experimental-sqlite peer.mjs <db file> <shared folder> <command> [args]
 * and it prints one line of JSON.
 */
import { DatabaseSync } from "node:sqlite";
import { setRepoDb, type Db, type SqlValue } from "../src/lib/db-adapter";
import * as repo from "../src/lib/repo";
import { BASE_SCHEMA, MIGRATIONS } from "../src/lib/schema";
import {
  disableSync,
  enableSync,
  syncOnce,
  syncStatus,
} from "../src/lib/sync/engine";
import { nodeFolder } from "../src/lib/sync/node-folder";

const [file, shared, command, ...args] = process.argv.slice(2);
const sql = new DatabaseSync(file);
sql.exec(BASE_SCHEMA);
const version = (
  sql.prepare("PRAGMA user_version").get() as { user_version: number }
).user_version;
for (let v = version; v < MIGRATIONS.length; v++) {
  sql.exec(MIGRATIONS[v]);
  sql.exec(`PRAGMA user_version = ${v + 1}`);
}

const db: Db = {
  async all<T>(q: string, params: SqlValue[] = []) {
    return sql.prepare(q).all(...params) as T[];
  },
  async get<T>(q: string, params: SqlValue[] = []) {
    return (sql.prepare(q).get(...params) ?? null) as T | null;
  },
  async run(q: string, params: SqlValue[] = []) {
    sql.prepare(q).run(...params);
  },
  async batch(statements) {
    sql.exec("BEGIN");
    try {
      for (const { sql: q, params } of statements) {
        if (params) sql.prepare(q).run(...params);
        else sql.exec(q);
      }
      sql.exec("COMMIT");
    } catch (error) {
      sql.exec("ROLLBACK");
      throw error;
    }
  },
};
setRepoDb(db);

async function main() {
  const folder = nodeFolder(`${shared}/mymanage-sync`);
  switch (command) {
    case "join":
      return { device: await enableSync(db) };
    case "sync":
      return await syncOnce(db, folder, { deviceName: "peer" });
    case "add-task":
      return await repo.createTask({ title: args[0] });
    case "retitle": {
      const [task] = (await repo.listTasks()).filter(
        (t) => t.title === args[0],
      );
      return await repo.updateTask(task.id, { title: args[1] });
    }
    case "tasks":
      return (await repo.listTasks()).map((t) => t.title).sort();
    case "categories":
      return (await repo.listCategories()).length;
    case "status":
      return await syncStatus(db);
    case "leave":
      await disableSync(db);
      return {};
    default:
      throw new Error(`unknown command ${command}`);
  }
}

main().then(
  (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
  (error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  },
);
