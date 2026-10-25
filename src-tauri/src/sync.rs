//! The shared folder for syncing between computers (sprint ד8): the page's
//! sync engine reads and writes small files there through these commands.
//!
//! The page can name only a path *inside* `<chosen folder>\mymanage-sync`:
//! relative, made of plain names, no `..`, no drive letters. A file is written
//! under a temporary name and renamed when it is whole, so a cloud drive — or
//! another computer — never sees half of one.

use crate::lang::tr;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::State;

/// The folder the person picked on this computer; none until the page says.
#[derive(Default)]
pub struct SyncRoot(Mutex<Option<PathBuf>>);

const FOLDER: &str = "mymanage-sync";
/// Journal files are small; anything bigger is not ours.
const MAX_BYTES: u64 = 64 * 1024 * 1024;

/// `v1/<device>/seg-….json`: names of letters, digits, `.`, `-` and `_`.
fn clean(rel: &str) -> Result<PathBuf, String> {
    let mut out = PathBuf::new();
    for part in rel.split('/').filter(|p| !p.is_empty()) {
        let plain = part
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'.' | b'-' | b'_'));
        if !plain || part.starts_with('.') {
            return Err(tr("That path isn't allowed", "הנתיב לא מותר"));
        }
        out.push(part);
    }
    Ok(out)
}

fn inside(root: &State<'_, SyncRoot>, rel: &str) -> Result<PathBuf, String> {
    let guard = root.0.lock().map_err(|e| e.to_string())?;
    let base = guard
        .as_ref()
        .ok_or_else(|| tr("No sync folder is chosen", "לא נבחרה תיקיית סנכרון"))?;
    Ok(base.join(FOLDER).join(clean(rel)?))
}

/// Remembers the folder, after checking that it is one. Returns its full path.
#[tauri::command]
pub fn sync_set_root(
    root: State<'_, SyncRoot>,
    path: Option<String>,
) -> Result<Option<String>, String> {
    let mut guard = root.0.lock().map_err(|e| e.to_string())?;
    let Some(path) = path else {
        *guard = None;
        return Ok(None);
    };
    let dir =
        fs::canonicalize(&path).map_err(|_| tr("That folder isn't there", "התיקייה לא קיימת"))?;
    if !dir.is_dir() {
        return Err(tr("That isn't a folder", "זו לא תיקייה"));
    }
    let shown = dir
        .to_string_lossy()
        .trim_start_matches(r"\\?\")
        .to_string();
    *guard = Some(dir);
    Ok(Some(shown))
}

/// The names inside a folder; none when it doesn't exist yet.
#[tauri::command]
pub fn sync_list(root: State<'_, SyncRoot>, dir: String) -> Result<Vec<String>, String> {
    let path = inside(&root, &dir)?;
    let Ok(entries) = fs::read_dir(&path) else {
        return Ok(vec![]);
    };
    Ok(entries
        .filter_map(|e| e.ok())
        .filter_map(|e| e.file_name().into_string().ok())
        .collect())
}

/// A file's text, or None when there is no such file.
#[tauri::command]
pub fn sync_read(root: State<'_, SyncRoot>, path: String) -> Result<Option<String>, String> {
    let file = inside(&root, &path)?;
    match fs::metadata(&file) {
        Ok(m) if m.len() > MAX_BYTES => Err(tr("The file is too big", "הקובץ גדול מדי")),
        Ok(_) => fs::read_to_string(&file)
            .map(Some)
            .map_err(|e| e.to_string()),
        Err(_) => Ok(None),
    }
}

static COUNTER: AtomicU64 = AtomicU64::new(0);

/// Writes the whole file or none of it: beside it first, flushed to disk,
/// then renamed over the name.
pub fn write_whole(file: &Path, text: &str) -> Result<(), String> {
    let dir = file.parent().ok_or("no folder")?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let temporary = dir.join(format!(
        "{}.tmp-{}-{}",
        file.file_name().and_then(|n| n.to_str()).unwrap_or("file"),
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let result = (|| -> std::io::Result<()> {
        let mut f = fs::File::create(&temporary)?;
        f.write_all(text.as_bytes())?;
        f.sync_all()?;
        fs::rename(&temporary, file)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn sync_write(root: State<'_, SyncRoot>, path: String, text: String) -> Result<(), String> {
    if text.len() as u64 > MAX_BYTES {
        return Err(tr("The file is too big", "הקובץ גדול מדי"));
    }
    write_whole(&inside(&root, &path)?, &text)
}

#[tauri::command]
pub fn sync_remove(root: State<'_, SyncRoot>, path: String) -> Result<(), String> {
    match fs::remove_file(inside(&root, &path)?) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// This computer's name, to tell computers apart in the list.
#[tauri::command]
pub fn sync_device_name() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("mymanage-sync-test-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn accepts_the_names_the_engine_uses() {
        assert!(
            clean("v1/0b1a2c3d-4e5f-6789-abcd-ef0123456789/seg-0000000001-0000000007.json").is_ok()
        );
        assert!(clean("").unwrap().as_os_str().is_empty());
        assert_eq!(
            clean("v1//device.json").unwrap(),
            PathBuf::from("v1").join("device.json")
        );
    }

    #[test]
    fn a_leading_slash_is_still_inside_the_folder() {
        // It is joined under the sync folder like any relative path.
        assert_eq!(
            clean("/etc/passwd").unwrap(),
            PathBuf::from("etc").join("passwd")
        );
    }

    #[test]
    fn refuses_anything_that_could_leave_the_folder() {
        for bad in [
            "../secrets.json",
            "v1/../../x",
            "..",
            "v1/./x",
            "C:/Windows/x",
            "v1\\x",
            "v1/a b",
            ".hidden",
            "v1/ünï",
        ] {
            assert!(clean(bad).is_err(), "{bad} should be refused");
        }
    }

    #[test]
    fn a_file_appears_whole_and_replaces_the_old_one() {
        let dir = temp_dir("write");
        let file = dir
            .join("v1")
            .join("dev")
            .join("seg-0000000001-0000000002.json");
        write_whole(&file, "first").unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "first");
        write_whole(&file, "second, longer").unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "second, longer");
        // Nothing is left beside it.
        let names: Vec<_> = fs::read_dir(file.parent().unwrap())
            .unwrap()
            .map(|e| e.unwrap().file_name().into_string().unwrap())
            .collect();
        assert_eq!(names, vec!["seg-0000000001-0000000002.json"]);
        fs::remove_dir_all(&dir).unwrap();
    }
}
