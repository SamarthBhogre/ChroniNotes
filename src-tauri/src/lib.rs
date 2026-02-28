mod db;
mod commands;
mod notifications;
mod updater;

use std::sync::Arc;
use tauri::Manager;
use db::Database;
use commands::timer::TimerState;
use commands::notes::NotesRoot;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(if cfg!(debug_assertions) {
                        log::LevelFilter::Debug
                    } else {
                        log::LevelFilter::Info
                    })
                    .build(),
            )?;

            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            let database = Database::new(&app_data_dir);
            app.manage(database);

            let notes_root = NotesRoot::new(&app_data_dir);
            app.manage(notes_root);

            // TimerState::new() returns Arc<TimerState>; manage the Arc so
            // commands can clone it cheaply into background threads without
            // any unsafe pointer arithmetic.
            let timer_state: Arc<TimerState> = TimerState::new();
            app.manage(timer_state);

            // Clone Arc<Database> — no unsafe, no raw pointers.
            let db_for_scheduler = app.state::<Database>().inner().clone();

            // `spawn_notification_scheduler` returns Err only when a scheduler
            // is already alive (e.g. the setup closure was somehow called
            // twice).  In normal operation this never fails; log and continue
            // rather than crashing the whole app.
            match notifications::spawn_notification_scheduler(
                app.handle().clone(),
                db_for_scheduler,
            ) {
                Ok(handle) => {
                    // Store ShutdownHandle in managed state so it lives for
                    // the full app lifetime.  A drop here would not stop the
                    // scheduler (no Drop impl), but keeping it in state makes
                    // the ownership relationship explicit.
                    app.manage(handle);
                }
                Err(e) => {
                    log::warn!("[App] Notification scheduler not started: {e}");
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Tasks
            commands::tasks::tasks_create,
            commands::tasks::tasks_list,
            commands::tasks::tasks_update_status,
            commands::tasks::tasks_update_due_date,
            commands::tasks::tasks_delete,
            commands::tasks::tasks_completion_history,
            commands::tasks::tasks_with_due_dates,
            // Timer / Pomodoro / Stopwatch
            commands::timer::pomodoro_get_settings,
            commands::timer::pomodoro_update_settings,
            commands::timer::pomodoro_start,
            commands::timer::pomodoro_pause,
            commands::timer::pomodoro_stop,
            commands::timer::stopwatch_start,
            commands::timer::stopwatch_pause,
            commands::timer::stopwatch_stop,
            commands::timer::focus_history,
            commands::timer::focus_today_minutes,
            commands::timer::focus_yesterday_minutes,
            commands::timer::timer_notify,
            // Notes
            commands::notes::notes_list,
            commands::notes::notes_get,
            commands::notes::notes_create,
            commands::notes::notes_create_folder,
            commands::notes::notes_update,
            commands::notes::notes_delete,
            commands::notes::notes_open_folder,
            commands::notes::notes_get_root,
            // Timer Presets
            commands::timer_presets::timer_presets_list,
            commands::timer_presets::timer_presets_create,
            commands::timer_presets::timer_presets_update,
            commands::timer_presets::timer_presets_delete,
            commands::timer_presets::timer_presets_toggle_favorite,
            // Calendar
            commands::calendar::calendar_create,
            commands::calendar::calendar_list,
            commands::calendar::calendar_list_by_date,
            commands::calendar::calendar_list_by_range,
            commands::calendar::calendar_update,
            commands::calendar::calendar_delete,
            commands::calendar::calendar_active_dates,
            // Updater
            updater::updater_check,
            updater::updater_download_and_install,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
