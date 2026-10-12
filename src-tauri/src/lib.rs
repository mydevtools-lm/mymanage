mod db;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // %APPDATA%\<identifier>\lior.db on Windows.
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            app.manage(db::Db::open(&dir.join("lior.db"))?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::db_all,
            db::db_run,
            db::db_exec,
            db::db_batch
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
