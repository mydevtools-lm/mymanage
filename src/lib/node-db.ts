import "server-only";
import { getDb } from "./db";
import { setRepoDb, type Db, type SqlValue } from "./db-adapter";

/**
 * repo.ts on node:sqlite. Each call asks getDb() for the connection, as the
 * synchronous code did, so the daily backup and test resets keep working.
 * Importing this module makes it the active database.
 */
export const nodeDb: Db = {
  async all<T>(sql: string, params: SqlValue[] = []) {
    return getDb().prepare(sql).all(...params) as T[];
  },
  async get<T>(sql: string, params: SqlValue[] = []) {
    return (getDb().prepare(sql).get(...params) ?? null) as T | null;
  },
  async run(sql: string, params: SqlValue[] = []) {
    getDb().prepare(sql).run(...params);
  },
  async batch(statements) {
    const db = getDb();
    db.exec("BEGIN");
    try {
      for (const { sql, params } of statements) {
        if (params) db.prepare(sql).run(...params);
        else db.exec(sql);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  },
};

setRepoDb(nodeDb);
