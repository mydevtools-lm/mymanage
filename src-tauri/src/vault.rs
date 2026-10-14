//! Where the secrets live: `secrets.json` in the app's data folder, each value
//! encrypted with Windows DPAPI under the signed-in user's key — the same
//! protection the Credential Manager itself uses, without its store.
//!
//! Why not the Credential Manager (the `keyring` crate): once it holds many
//! entries (here 720, mostly other apps' tokens) Windows refuses every new
//! entry above a couple of hundred bytes with error 8, "not enough memory".
//! A calendar address doesn't fit. A file has no such limit, and only this
//! Windows user on this computer can decrypt it.

use serde_json::{Map, Value};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Vault {
    file: PathBuf,
    // One writer at a time: read, change, write the whole file.
    lock: Mutex<()>,
}

impl Vault {
    pub fn new(file: PathBuf) -> Self {
        Vault { file, lock: Mutex::new(()) }
    }

    fn load(&self) -> Result<Map<String, Value>, String> {
        match fs::read_to_string(&self.file) {
            Ok(text) => match serde_json::from_str(&text) {
                Ok(Value::Object(map)) => Ok(map),
                _ => Err("קובץ הסודות פגום".into()),
            },
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Map::new()),
            Err(e) => Err(e.to_string()),
        }
    }

    fn save(&self, map: &Map<String, Value>) -> Result<(), String> {
        let text = serde_json::to_string_pretty(map).map_err(|e| e.to_string())?;
        // Written beside and renamed over, so a crash never leaves half a file.
        let tmp = self.file.with_extension("json.tmp");
        fs::write(&tmp, text).map_err(|e| e.to_string())?;
        fs::rename(&tmp, &self.file).map_err(|e| e.to_string())
    }

    pub fn get(&self, name: &str) -> Result<Option<String>, String> {
        let _guard = self.lock.lock().map_err(|e| e.to_string())?;
        match self.load()?.get(name).and_then(Value::as_str) {
            Some(hex) => Ok(Some(crypt::open(&from_hex(hex)?)?)),
            None => Ok(None),
        }
    }

    pub fn set(&self, name: &str, secret: &str) -> Result<(), String> {
        let _guard = self.lock.lock().map_err(|e| e.to_string())?;
        let mut map = self.load()?;
        map.insert(name.into(), Value::String(to_hex(&crypt::seal(secret)?)));
        self.save(&map)
    }

    pub fn remove(&self, name: &str) -> Result<(), String> {
        let _guard = self.lock.lock().map_err(|e| e.to_string())?;
        let mut map = self.load()?;
        if map.remove(name).is_some() {
            self.save(&map)?;
        }
        Ok(())
    }

    pub fn has(&self, name: &str) -> Result<bool, String> {
        let _guard = self.lock.lock().map_err(|e| e.to_string())?;
        Ok(self.load()?.contains_key(name))
    }
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn from_hex(text: &str) -> Result<Vec<u8>, String> {
    if !text.len().is_multiple_of(2) {
        return Err("קובץ הסודות פגום".into());
    }
    (0..text.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&text[i..i + 2], 16).map_err(|_| "קובץ הסודות פגום".to_string()))
        .collect()
}

#[cfg(windows)]
mod crypt {
    use windows_sys::Win32::Foundation::{LocalFree, GetLastError};
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    // Ties the encrypted values to this app: another program running as the
    // same user can't decrypt them by passing them to DPAPI alone.
    const ENTROPY: &[u8] = b"management/secrets/v1";

    fn blob(bytes: &[u8]) -> CRYPT_INTEGER_BLOB {
        CRYPT_INTEGER_BLOB { cbData: bytes.len() as u32, pbData: bytes.as_ptr() as *mut u8 }
    }

    fn take(out: CRYPT_INTEGER_BLOB) -> Vec<u8> {
        unsafe {
            let bytes = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
            LocalFree(out.pbData as _);
            bytes
        }
    }

    pub fn seal(secret: &str) -> Result<Vec<u8>, String> {
        let input = blob(secret.as_bytes());
        let entropy = blob(ENTROPY);
        let mut out = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
        let ok = unsafe {
            CryptProtectData(&input, std::ptr::null(), &entropy, std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut out)
        };
        if ok == 0 {
            return Err(format!("ההצפנה נכשלה ({})", unsafe { GetLastError() }));
        }
        Ok(take(out))
    }

    pub fn open(sealed: &[u8]) -> Result<String, String> {
        let input = blob(sealed);
        let entropy = blob(ENTROPY);
        let mut out = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
        let ok = unsafe {
            CryptUnprotectData(&input, std::ptr::null_mut(), &entropy, std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut out)
        };
        if ok == 0 {
            return Err(format!("הפענוח נכשל ({})", unsafe { GetLastError() }));
        }
        String::from_utf8(take(out)).map_err(|_| "הסוד השמור אינו טקסט".into())
    }
}

#[cfg(not(windows))]
mod crypt {
    const NO: &str = "שמירת סודות נתמכת כרגע רק ב-Windows";
    pub fn seal(_: &str) -> Result<Vec<u8>, String> {
        Err(NO.into())
    }
    pub fn open(_: &[u8]) -> Result<String, String> {
        Err(NO.into())
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn keeps_secrets_encrypted_and_removes_them() {
        let dir = std::env::temp_dir().join(format!("app-vault-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let vault = Vault::new(dir.join("secrets.json"));
        let address = format!("https://calendar.google.com/calendar/ical/{}/basic.ics", "x".repeat(200));

        assert_eq!(vault.get("calendar-1").unwrap(), None);
        vault.set("calendar-1", &address).unwrap();
        vault.set("anthropic", "sk-ant-test-שלום").unwrap();
        assert_eq!(vault.get("calendar-1").unwrap().as_deref(), Some(address.as_str()));
        assert!(vault.has("anthropic").unwrap());

        // Nothing readable on disk.
        let on_disk = fs::read_to_string(dir.join("secrets.json")).unwrap();
        assert!(!on_disk.contains("calendar.google.com") && !on_disk.contains("sk-ant"));

        vault.remove("calendar-1").unwrap();
        vault.remove("calendar-1").unwrap();
        assert_eq!(vault.get("calendar-1").unwrap(), None);
        assert_eq!(vault.get("anthropic").unwrap().as_deref(), Some("sk-ant-test-שלום"));
        fs::remove_dir_all(&dir).unwrap();
    }
}
