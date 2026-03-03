mod db;
mod commands;
mod notifications;
mod updater;

use std::sync::Arc;
use tauri::Manager;
use db::Database;
use commands::timer::TimerState;
use commands::notes::NotesRoot;

#[cfg(target_os = "windows")]
fn set_window_icon_win32(window: &tauri::WebviewWindow) {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SendMessageW, ICON_BIG, ICON_SMALL, WM_SETICON,
        LoadImageW, IMAGE_ICON, LR_LOADFROMFILE, LR_DEFAULTSIZE,
    };
    use windows_sys::Win32::Foundation::HWND;

    // Embed the .ico at compile time, write to temp so LoadImageW can read it.
    let ico_bytes = include_bytes!("../icons/ChroniNotes.ico");
    let tmp = std::env::temp_dir().join("chroninotes_icon.ico");
    std::fs::write(&tmp, ico_bytes).ok();

    let path_wide: Vec<u16> = tmp.to_string_lossy()
        .encode_utf16()
        .chain(std::iter::once(0u16))
        .collect();

    // raw_window_handle() returns RawWindowHandle directly on Tauri's WebviewWindow
    let hwnd = match window.window_handle().map(|h| h.as_raw()) {
        Ok(RawWindowHandle::Win32(h)) => h.hwnd.get() as HWND,
        _ => return,
    };

    unsafe {
        let hicon_big = LoadImageW(
            std::ptr::null_mut(),
            path_wide.as_ptr(),
            IMAGE_ICON,
            0, 0,
            LR_LOADFROMFILE | LR_DEFAULTSIZE,
        );
        let hicon_small = LoadImageW(
            std::ptr::null_mut(),
            path_wide.as_ptr(),
            IMAGE_ICON,
            16, 16,
            LR_LOADFROMFILE,
        );

        if !hicon_big.is_null() {
            SendMessageW(hwnd, WM_SETICON, ICON_BIG as usize, hicon_big as isize);
        }
        if !hicon_small.is_null() {
            SendMessageW(hwnd, WM_SETICON, ICON_SMALL as usize, hicon_small as isize);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Set the window icon via Win32 WM_SETICON so the taskbar and
            // alt-tab show the correct high-res icon even with decorations off.
            #[cfg(target_os = "windows")]
            if let Some(window) = app.get_webview_window("main") {
                set_window_icon_win32(&window);
            }

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
            commands::notes::notes_move,
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
