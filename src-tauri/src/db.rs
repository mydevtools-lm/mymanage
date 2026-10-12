//! The SQLite bridge. The screens keep their queries in TypeScript and send
//! them here; Rust owns the file, the connection and transactions.
//!
//! One connection behind a mutex: the app has a single window and a single
//! user, and one connection is what makes a `batch` a real transaction.

use rusqlite::types::{Value, ValueRef};
use rusqlite::{params_from_iter, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Number, Value as Json};
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

pub struct Db(pub Mutex<Connection>);

impl Db {
    pub fn open(file: &Path) -> rusqlite::Result<Self> {
        let conn = Connection::open(file)?;
        conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")?;
        Ok(Db(Mutex::new(conn)))
    }

    #[cfg(test)]
    pub fn memory() -> Self {
        Db(Mutex::new(Connection::open_in_memory().unwrap()))
    }
}

/// JSON from the screens to a SQLite value. Booleans become 0/1 and nested
/// objects or arrays are stored as JSON text, as node:sqlite callers expect.
fn to_sql(value: &Json) -> Value {
    match value {
        Json::Null => Value::Null,
        Json::Bool(b) => Value::Integer(*b as i64),
        Json::Number(n) => match n.as_i64() {
            Some(i) => Value::Integer(i),
            None => Value::Real(n.as_f64().unwrap_or(0.0)),
        },
        Json::String(s) => Value::Text(s.clone()),
        other => Value::Text(other.to_string()),
    }
}

fn to_json(value: ValueRef<'_>) -> Json {
    match value {
        ValueRef::Null => Json::Null,
        ValueRef::Integer(i) => Json::Number(i.into()),
        ValueRef::Real(f) => Number::from_f64(f).map_or(Json::Null, Json::Number),
        ValueRef::Text(t) => Json::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(_) => Json::Null,
    }
}

fn query(conn: &Connection, sql: &str, params: &[Json]) -> rusqlite::Result<Vec<Map<String, Json>>> {
    let mut stmt = conn.prepare(sql)?;
    let names: Vec<String> = stmt.column_names().iter().map(|n| n.to_string()).collect();
    let mut rows = stmt.query(params_from_iter(params.iter().map(to_sql)))?;
    let mut out = Vec::new();
    while let Some(row) = rows.next()? {
        let mut record = Map::new();
        for (i, name) in names.iter().enumerate() {
            record.insert(name.clone(), to_json(row.get_ref(i)?));
        }
        out.push(record);
    }
    Ok(out)
}

#[derive(Serialize)]
pub struct RunResult {
    changes: usize,
}

#[derive(Deserialize)]
pub struct Statement {
    sql: String,
    #[serde(default)]
    params: Vec<Json>,
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Rows of a SELECT, each as a column → value object.
#[tauri::command]
pub fn db_all(db: State<'_, Db>, sql: String, params: Vec<Json>) -> Result<Vec<Map<String, Json>>, String> {
    let conn = db.0.lock().map_err(err)?;
    query(&conn, &sql, &params).map_err(err)
}

/// One INSERT / UPDATE / DELETE.
#[tauri::command]
pub fn db_run(db: State<'_, Db>, sql: String, params: Vec<Json>) -> Result<RunResult, String> {
    let conn = db.0.lock().map_err(err)?;
    let changes = conn
        .execute(&sql, params_from_iter(params.iter().map(to_sql)))
        .map_err(err)?;
    Ok(RunResult { changes })
}

/// Several statements with no parameters, as one script (schema, PRAGMA).
#[tauri::command]
pub fn db_exec(db: State<'_, Db>, sql: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(err)?;
    conn.execute_batch(&sql).map_err(err)
}

/// Statements that must land together: all of them, or none.
#[tauri::command]
pub fn db_batch(db: State<'_, Db>, statements: Vec<Statement>) -> Result<usize, String> {
    let mut conn = db.0.lock().map_err(err)?;
    batch(&mut conn, &statements).map_err(err)
}

fn batch(conn: &mut Connection, statements: &[Statement]) -> rusqlite::Result<usize> {
    let tx = conn.transaction()?;
    let mut changes = 0;
    for s in statements {
        if s.params.is_empty() {
            tx.execute_batch(&s.sql)?;
        } else {
            changes += tx.execute(&s.sql, params_from_iter(s.params.iter().map(to_sql)))?;
        }
    }
    tx.commit()?;
    Ok(changes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn stmt(sql: &str, params: Vec<Json>) -> Statement {
        Statement { sql: sql.into(), params }
    }

    #[test]
    fn round_trips_values() {
        let db = Db::memory();
        let conn = db.0.lock().unwrap();
        conn.execute_batch("CREATE TABLE t (a TEXT, b INTEGER, c REAL, d TEXT)").unwrap();
        conn.execute(
            "INSERT INTO t VALUES (?, ?, ?, ?)",
            params_from_iter([json!("שלום"), json!(true), json!(1.5), json!(null)].iter().map(to_sql)),
        )
        .unwrap();
        let rows = query(&conn, "SELECT * FROM t", &[]).unwrap();
        assert_eq!(rows[0]["a"], json!("שלום"));
        assert_eq!(rows[0]["b"], json!(1));
        assert_eq!(rows[0]["c"], json!(1.5));
        assert_eq!(rows[0]["d"], Json::Null);
    }

    #[test]
    fn batch_rolls_back_when_one_statement_fails() {
        let db = Db::memory();
        let mut conn = db.0.lock().unwrap();
        conn.execute_batch("CREATE TABLE t (id TEXT PRIMARY KEY)").unwrap();
        let result = batch(
            &mut conn,
            &[
                stmt("INSERT INTO t VALUES (?)", vec![json!("a")]),
                stmt("INSERT INTO t VALUES (?)", vec![json!("a")]),
            ],
        );
        assert!(result.is_err());
        let rows = query(&conn, "SELECT * FROM t", &[]).unwrap();
        assert!(rows.is_empty());
    }
}
