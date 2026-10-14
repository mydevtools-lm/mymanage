//! Updates from GitHub Releases (DESKTOP.md 6.3): the app looks, asks, and
//! only then installs — after a backup of the database. Signed by the
//! project's key; a build without one (any local build) has no updater at all.
//!
//! The updater's settings (public key, address) come from a configuration
//! overlay the release workflow writes, so nothing here names the repository.

use crate::db::Db;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_updater::{Update, UpdaterExt};

pub struct Updates {
    /// Built with the updater's settings.
    pub enabled: bool,
    found: Mutex<Option<Update>>,
    /// "On exit": installed when the app is quit from the tray.
    on_exit: Mutex<Option<String>>,
}

impl Updates {
    pub fn new(enabled: bool) -> Self {
        Updates { enabled, found: Mutex::new(None), on_exit: Mutex::new(None) }
    }
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[derive(Serialize)]
pub struct About {
    version: String,
    updates: bool,
}

#[tauri::command]
pub fn app_about<R: Runtime>(app: AppHandle<R>, updates: State<'_, Updates>) -> About {
    About { version: app.package_info().version.to_string(), updates: updates.enabled }
}

#[derive(Serialize)]
pub struct Found {
    version: String,
    notes: Option<String>,
}

/// None when there is nothing newer, or no updater in this build.
#[tauri::command]
pub async fn update_check<R: Runtime>(
    app: AppHandle<R>,
    updates: State<'_, Updates>,
) -> Result<Option<Found>, String> {
    if !updates.enabled {
        return Ok(None);
    }
    let update = app.updater().map_err(err)?.check().await.map_err(err)?;
    let found = update.as_ref().map(|u| Found { version: u.version.clone(), notes: u.body.clone() });
    *updates.found.lock().map_err(err)? = update;
    Ok(found)
}

/// The database first, then the update: the installer replaces the app and
/// Windows closes it; the new version opens on the same data.
async fn install<R: Runtime>(app: &AppHandle<R>, today: &str) -> Result<(), String> {
    let update = app.state::<Updates>().found.lock().map_err(err)?.take();
    let Some(update) = update else { return Err("אין עדכון שמחכה".into()) };
    app.state::<Db>().backup(&format!("{today}-before-update"))?;
    update.download_and_install(|_, _| {}, || {}).await.map_err(err)
}

#[tauri::command]
pub async fn update_install<R: Runtime>(app: AppHandle<R>, today: String) -> Result<(), String> {
    install(&app, &today).await
}

/// Installs when the app is next quit from the tray.
#[tauri::command]
pub fn update_on_exit(updates: State<'_, Updates>, today: String) -> Result<(), String> {
    *updates.on_exit.lock().map_err(err)? = Some(today);
    Ok(())
}

/// The tray's "quit": an update waiting for the exit goes in now.
pub fn quit<R: Runtime>(app: &AppHandle<R>) {
    let waiting = app.state::<Updates>().on_exit.lock().ok().and_then(|mut d| d.take());
    match waiting {
        Some(today) => {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = install(&app, &today).await {
                    log::error!("update on exit: {e}");
                }
                app.exit(0);
            });
        }
        None => app.exit(0),
    }
}
