mod db;
mod commands;

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
            // Set up logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Resolve app data directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            // Initialize database
            let database = Database::new(&app_data_dir);
            app.manage(database);

            // Initialize notes root
            let notes_root = NotesRoot::new(&app_data_dir);
            app.manage(notes_root);

            // Initialize timer state
            let timer_state = TimerState::new();
            app.manage(timer_state);

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
