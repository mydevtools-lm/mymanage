//! Database snapshots, by the same rule as the server's db.ts: one a day and
//! one before each migration, in `backups/` next to the database, the last 14
//! kept. VACUUM INTO writes a consistent copy while the app keeps running.

use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};

pub const KEEP: usize = 14;
const PREFIX: &str = "backup-";

/// `2026-10-13`, or `2026-10-13-before-v8` ahead of a migration. Anything else
/// is refused, so the screens can't name a file outside the folder.
fn valid_label(label: &str) -> bool {
    let b = label.as_bytes();
    let date = b.len() >= 10
        && b[..10]
            .iter()
            .enumerate()
            .all(|(i, c)| if i == 4 || i == 7 { *c == b'-' } else { c.is_ascii_digit() });
    let rest = &label[10.min(label.len())..];
    let suffix = rest.is_empty()
        || rest
            .strip_prefix("-before-v")
            .is_some_and(|v| !v.is_empty() && v.bytes().all(|c| c.is_ascii_digit()));
    date && suffix
}

/// Writes `backup-<label>.db` unless it is already there, then trims the folder
/// to the newest KEEP. With `also` (a folder the person picked — another
/// drive, a synced folder) the same file is copied there and trimmed the same
/// way. Returns the new file, or None when there was nothing to do.
pub fn snapshot(
    conn: &Connection,
    dir: &Path,
    label: &str,
    also: Option<&Path>,
) -> Result<Option<PathBuf>, String> {
    if !valid_label(label) {
        return Err(format!("שם גיבוי לא תקין: {label}"));
    }
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let name = format!("{PREFIX}{label}.db");
    let target = dir.join(&name);
    let written = if target.exists() {
        None
    } else {
        conn.execute("VACUUM INTO ?1", [target.to_string_lossy()])
            .map_err(|e| e.to_string())?;
        prune(dir).map_err(|e| e.to_string())?;
        Some(target.clone())
    };
    // Copied even when today's file already existed: a folder picked midday
    // gets today's backup now, not tomorrow.
    if let Some(also) = also {
        let copy = also.join(&name);
        if !copy.exists() {
            fs::create_dir_all(also).map_err(|e| format!("תיקיית הגיבוי הנוספת: {e}"))?;
            fs::copy(&target, &copy).map_err(|e| format!("תיקיית הגיבוי הנוספת: {e}"))?;
            prune(also).map_err(|e| e.to_string())?;
        }
    }
    Ok(written)
}

/// Names start with the date, so name order is age order.
fn prune(dir: &Path) -> std::io::Result<()> {
    let mut names: Vec<String> = fs::read_dir(dir)?
        .filter_map(|entry| entry.ok()?.file_name().into_string().ok())
        .filter(|name| name.starts_with(PREFIX) && name.ends_with(".db"))
        .collect();
    names.sort();
    let extra = names.len().saturating_sub(KEEP);
    for old in &names[..extra] {
        fs::remove_file(dir.join(old))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("app-backup-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn accepts_only_dates_and_migration_labels() {
        assert!(valid_label("2026-10-13"));
        assert!(valid_label("2026-10-13-before-v8"));
        assert!(!valid_label("../2026-10-13"));
        assert!(!valid_label("2026-10-13-before-v"));
        assert!(!valid_label("2026-10-13.db"));
        assert!(!valid_label("today"));
    }

    #[test]
    fn writes_once_a_label_and_keeps_the_newest_fourteen() {
        let dir = temp_dir("keep");
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE t (a TEXT); INSERT INTO t VALUES ('x')").unwrap();

        for day in 1..=16 {
            let label = format!("2099-01-{day:02}");
            assert!(snapshot(&conn, &dir, &label, None).unwrap().is_some());
        }
        assert!(snapshot(&conn, &dir, "2099-01-16", None).unwrap().is_none());

        let mut names: Vec<String> = fs::read_dir(&dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().into_string().unwrap())
            .collect();
        names.sort();
        assert_eq!(names.len(), KEEP);
        assert_eq!(names[0], "backup-2099-01-03.db");

        let copy = Connection::open(dir.join("backup-2099-01-16.db")).unwrap();
        let a: String = copy.query_row("SELECT a FROM t", [], |r| r.get(0)).unwrap();
        assert_eq!(a, "x");
        drop(copy);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn copies_to_the_extra_folder_even_when_today_is_already_backed_up() {
        let dir = temp_dir("main");
        let extra = temp_dir("extra");
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE t (a TEXT)").unwrap();

        snapshot(&conn, &dir, "2099-02-01", None).unwrap();
        assert!(snapshot(&conn, &dir, "2099-02-01", Some(&extra)).unwrap().is_none());
        assert!(extra.join("backup-2099-02-01.db").exists());
        fs::remove_dir_all(&dir).unwrap();
        fs::remove_dir_all(&extra).unwrap();
    }
}
