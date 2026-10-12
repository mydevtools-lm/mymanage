//! Secrets and the network, kept in Rust (DESKTOP.md 5.4). The Google iCal
//! addresses and the Claude key are kept encrypted by vault.rs; the
//! screens write each one once and only ever learn whether it is set. Rust
//! reads the secret, makes the request and hands back the answer, so the
//! secret never reaches the page.

use crate::vault::Vault;
use serde::Serialize;
use serde_json::Value as Json;
use std::time::Duration;
use tauri::State;

const CALENDARS: u8 = 9;
const CLAUDE: &str = "anthropic";
const CLAUDE_URL: &str = "https://api.anthropic.com/v1/messages";

/// `calendar-1` … `calendar-9`, or `anthropic`.
fn valid_name(name: &str) -> bool {
    name == CLAUDE
        || name
            .strip_prefix("calendar-")
            .and_then(|n| n.parse::<u8>().ok())
            .is_some_and(|n| (1..=CALENDARS).contains(&n) && name.len() == "calendar-1".len())
}

/// What may be stored under a name; the error is shown on screen as is.
fn checked_value(name: &str, value: &str) -> Result<String, String> {
    let value = value.trim();
    if name != CLAUDE && !value.starts_with("https://") {
        return Err("כתובת היומן צריכה להתחיל ב-https://".into());
    }
    if value.len() > 4096 {
        return Err("הערך ארוך מדי".into());
    }
    Ok(value.to_string())
}

#[derive(Serialize)]
pub struct SecretStatus {
    /// Numbers of the calendars that have an address, e.g. ["1", "3"].
    calendars: Vec<String>,
    claude: bool,
}

#[tauri::command]
pub fn secret_status(vault: State<'_, Vault>) -> Result<SecretStatus, String> {
    let mut calendars = Vec::new();
    for n in 1..=CALENDARS {
        if vault.has(&format!("calendar-{n}"))? {
            calendars.push(n.to_string());
        }
    }
    Ok(SecretStatus { calendars, claude: vault.has(CLAUDE)? })
}

/// Stores a secret; an empty value removes it.
#[tauri::command]
pub fn secret_set(vault: State<'_, Vault>, name: String, value: String) -> Result<(), String> {
    if !valid_name(&name) {
        return Err(format!("אין סוד בשם {name}"));
    }
    if value.trim().is_empty() {
        return vault.remove(&name);
    }
    vault.set(&name, &checked_value(&name, &value)?)
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())
}

/// The calendar's .ics text. Google sends no CORS headers, so the page can't
/// fetch it itself; parsing stays in TypeScript (ical-parse.ts). Errors carry
/// the status only — the address is the secret.
#[tauri::command]
pub async fn calendar_fetch(vault: State<'_, Vault>, id: String) -> Result<String, String> {
    let name = format!("calendar-{id}");
    if !valid_name(&name) {
        return Err(format!("אין יומן מספר {id}"));
    }
    let url = vault.get(&name)?.ok_or("היומן לא מחובר")?;
    let response = client()?
        .get(url)
        .send()
        .await
        .map_err(|e| e.without_url().to_string())?;
    if !response.status().is_success() {
        return Err(format!("Google Calendar {id} returned {}", response.status().as_u16()));
    }
    response.text().await.map_err(|e| e.without_url().to_string())
}

/// One Messages API call with the stored key. The page builds the request
/// (assist-request.ts) and reads the answer; Rust adds the key and the fixed
/// address, and nothing else.
#[tauri::command]
pub async fn assist_parse(vault: State<'_, Vault>, body: Json) -> Result<Json, String> {
    let key = vault.get(CLAUDE)?.ok_or("אין מפתח Claude")?;
    let response = client()?
        .post(CLAUDE_URL)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.without_url().to_string())?;
    if !response.status().is_success() {
        return Err(format!("Claude API {}", response.status().as_u16()));
    }
    response.json().await.map_err(|e| e.without_url().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn knows_only_its_own_secrets() {
        assert!(valid_name("anthropic"));
        assert!(valid_name("calendar-1"));
        assert!(valid_name("calendar-9"));
        assert!(!valid_name("calendar-0"));
        assert!(!valid_name("calendar-10"));
        assert!(!valid_name("calendar-01"));
        assert!(!valid_name("calendar-"));
        assert!(!valid_name("github"));
    }

    #[test]
    fn a_calendar_address_must_be_https() {
        assert!(checked_value("calendar-1", "http://example.com/a.ics").is_err());
        assert_eq!(
            checked_value("calendar-1", "  https://example.com/a.ics ").unwrap(),
            "https://example.com/a.ics"
        );
        assert_eq!(checked_value("anthropic", " key ").unwrap(), "key");
    }
}
