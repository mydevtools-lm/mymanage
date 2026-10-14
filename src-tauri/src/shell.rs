//! What makes this a desktop app rather than a tab (DESKTOP.md 6.2): one
//! instance, a tray icon, closing to the tray, and starting hidden when
//! Windows launches it at sign-in.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime, State, Window, WindowEvent};

/// The argument autostart passes, so a sign-in launch stays in the tray.
pub const MINIMIZED: &str = "--minimized";

/// Whether closing the window hides it (the default) or quits. The page sets
/// it from its preferences on every start.
pub struct CloseToTray(AtomicBool);

impl Default for CloseToTray {
    fn default() -> Self {
        CloseToTray(AtomicBool::new(true))
    }
}

/// Set by scripts/desktop-smoke.mjs only: notifications and links are written
/// down instead of shown or opened, so a test run stays quiet and opens no
/// browser. Unset — every normal launch — this does nothing.
pub const QUIET_ENV: &str = "MANAGEMENT_SMOKE_QUIET";

pub struct Quiet(Option<Mutex<Vec<String>>>);

impl Default for Quiet {
    fn default() -> Self {
        Quiet(std::env::var_os(QUIET_ENV).map(|_| Mutex::new(Vec::new())))
    }
}

impl Quiet {
    /// True when the call was recorded instead of carried out.
    fn record(&self, call: String) -> bool {
        match &self.0 {
            Some(calls) => {
                if let Ok(mut calls) = calls.lock() {
                    calls.push(call);
                }
                true
            }
            None => false,
        }
    }
}

/// Brings the window back from the tray, or from behind other windows.
pub fn show<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "פתיחה", true, None::<&str>)?;
    let add = MenuItem::with_id(app, "quick-add", "משימה חדשה", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "יציאה", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &add, &separator, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip(app.package_info().name.clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show(app),
            "quick-add" => {
                show(app);
                // The page opens the new-task dialog, as ?new=task does.
                let _ = app.emit("tray-quick-add", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// Closing the window: to the tray, unless the person turned that off.
pub fn on_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        let state = window.state::<CloseToTray>();
        if state.0.load(Ordering::Relaxed) {
            api.prevent_close();
            let _ = window.hide();
        }
    }
}

#[tauri::command]
pub fn shell_set_close_to_tray(state: State<'_, CloseToTray>, on: bool) {
    state.0.store(on, Ordering::Relaxed);
}

/// Whether the person is looking at the window: shown, not minimised, and
/// focused. The page can't tell by itself — with background throttling off,
/// WebView2 reports "visible" even while the window sits in the tray.
#[tauri::command]
pub fn shell_in_front<R: Runtime>(app: AppHandle<R>) -> bool {
    app.get_webview_window("main").is_some_and(|w| {
        w.is_visible().unwrap_or(false)
            && !w.is_minimized().unwrap_or(false)
            && w.is_focused().unwrap_or(false)
    })
}

/// Where the database, its backups and the secrets live.
#[tauri::command]
pub fn shell_data_dir<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

/// Opens that folder in Explorer. The page can't open any other path.
#[tauri::command]
pub fn shell_open_data_dir<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let dir = shell_data_dir(app.clone())?;
    app.opener().open_path(dir, None::<&str>).map_err(|e| e.to_string())
}

/// A Windows notification. Through Rust rather than the plugin's page API, so
/// the page holds no notification permissions of its own.
#[tauri::command]
pub fn shell_notify<R: Runtime>(
    app: AppHandle<R>,
    quiet: State<'_, Quiet>,
    title: String,
    body: String,
) -> Result<(), String> {
    if quiet.record(format!("notify: {title}")) {
        return Ok(());
    }
    app.notification().builder().title(title).body(body).show().map_err(|e| e.to_string())
}

/// Only web addresses leave the app, to the default browser.
fn web_address(url: &str) -> bool {
    url.starts_with("https://") || url.starts_with("http://")
}

#[tauri::command]
pub fn shell_open_url<R: Runtime>(
    app: AppHandle<R>,
    quiet: State<'_, Quiet>,
    url: String,
) -> Result<(), String> {
    if !web_address(&url) {
        return Err("רק כתובות http ו-https נפתחות".into());
    }
    if quiet.record(format!("open: {url}")) {
        return Ok(());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

/// What a quiet run recorded; empty on a normal launch.
#[tauri::command]
pub fn shell_quiet_calls(quiet: State<'_, Quiet>) -> Vec<String> {
    quiet.0.as_ref().and_then(|c| c.lock().ok().map(|c| c.clone())).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_only_web_addresses() {
        assert!(web_address("https://example.com/a"));
        assert!(web_address("http://example.com"));
        assert!(!web_address("file:///C:/Windows/System32/calc.exe"));
        assert!(!web_address("ms-settings:"));
        assert!(!web_address("javascript:alert(1)"));
    }
}
