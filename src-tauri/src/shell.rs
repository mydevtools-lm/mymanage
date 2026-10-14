//! What makes this a desktop app rather than a tab (DESKTOP.md 6.2): one
//! instance, a tray icon, closing to the tray, and starting hidden when
//! Windows launches it at sign-in.

use std::sync::atomic::{AtomicBool, Ordering};
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

/// Where the database, its backups and the secrets live.
#[tauri::command]
pub fn shell_data_dir<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}
