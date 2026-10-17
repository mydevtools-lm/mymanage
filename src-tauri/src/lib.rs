mod backup;
mod db;
mod lang;
mod services;
mod shell;
mod updates;
mod vault;

use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    // Only a release build carries the updater's settings (its key and
    // address, written by .github/workflows/release.yml); without them the
    // plugin isn't loaded and the app never looks for updates.
    let updates = context.config().plugins.0.contains_key("updater");

    let mut builder = tauri::Builder::default()
        // First: a second launch hands over to the running one and exits.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            shell::show(app)
        }))
        // Size and place are remembered; whether it was showing is not —
        // that is the tray's and autostart's call.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![shell::MINIMIZED]),
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(shell::CloseToTray::default())
        .manage(updates::Updates::new(updates))
        .manage(shell::Quiet::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // %APPDATA%\<identifier>\data.db on Windows, backups\ beside it.
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            app.manage(db::Db::open(&dir.join("data.db"))?);
            app.manage(vault::Vault::new(dir.join("secrets.json")));

            shell::tray(app.handle())?;
            // The window starts hidden (tauri.conf.json) so a sign-in launch
            // never flashes; any other launch shows it.
            if !std::env::args().any(|a| a == shell::MINIMIZED) {
                shell::show(app.handle());
            }
            Ok(())
        })
        .on_window_event(shell::on_window_event)
        .invoke_handler(tauri::generate_handler![
            db::db_all,
            db::db_run,
            db::db_exec,
            db::db_batch,
            db::db_backup,
            services::secret_status,
            services::secret_set,
            services::calendar_fetch,
            services::assist_parse,
            shell::shell_set_close_to_tray,
            shell::shell_set_language,
            shell::shell_in_front,
            shell::shell_data_dir,
            shell::shell_open_data_dir,
            shell::shell_notify,
            shell::shell_open_url,
            shell::shell_quiet_calls,
            updates::app_about,
            updates::update_check,
            updates::update_install,
            updates::update_on_exit
        ]);
    if updates {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }
    builder
        .run(context)
        .expect("error while building tauri application");
}
