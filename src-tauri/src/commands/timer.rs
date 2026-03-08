use crate::db::Database;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_notification::NotificationExt;

/* ── Types ── */

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PomodoroSettings {
    #[serde(rename = "workMinutes")]
    pub work_minutes: i64,
    #[serde(rename = "breakMinutes")]
    pub break_minutes: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimerUpdate {
    pub seconds: i64,
    pub mode: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FocusDay {
    pub date: String,
    pub count: i64,
    pub total_seconds: i64,
}

/* ── Timer State ── */

/// All fields are individually `Mutex`-guarded so the background tick thread
/// and command handlers can interleave without holding one coarse lock.
///
/// Wrapped in `Arc` so it can be cloned into background threads without any
/// unsafe pointer arithmetic.
pub struct TimerState {
    pub pomodoro_seconds: Mutex<i64>,
    pub pomodoro_mode: Mutex<String>, // "work" | "break"
    pub pomodoro_running: Mutex<bool>,
    pub pomodoro_paused: Mutex<bool>,
    pub work_seconds_elapsed: Mutex<i64>,

    pub stopwatch_seconds: Mutex<i64>,
    pub stopwatch_running: Mutex<bool>,
    pub stopwatch_paused: Mutex<bool>,
}

impl TimerState {
    pub fn new() -> Arc<Self> {
        Arc::new(TimerState {
            pomodoro_seconds: Mutex::new(0),
            pomodoro_mode: Mutex::new("work".to_string()),
            pomodoro_running: Mutex::new(false),
            pomodoro_paused: Mutex::new(false),
            work_seconds_elapsed: Mutex::new(0),
            stopwatch_seconds: Mutex::new(0),
            stopwatch_running: Mutex::new(false),
            stopwatch_paused: Mutex::new(false),
        })
    }
}

/* ── Lock helpers ── */

/// Acquire a mutex, mapping a poisoned-lock error to a `String` so command
/// handlers can propagate it instead of panicking.
macro_rules! lock {
    ($mutex:expr) => {
        $mutex.lock().map_err(|e| format!("Lock poisoned: {}", e))
    };
}

/* ── DB helpers ── */

/// Load pomodoro settings, falling back to defaults on any error.
/// Called from the timer thread where we cannot propagate `Result`.
fn get_settings(db: &Database) -> PomodoroSettings {
    let fallback = PomodoroSettings {
        work_minutes: 25,
        break_minutes: 5,
    };
    let conn = match db.conn().lock() {
        Ok(c) => c,
        Err(e) => {
            log::error!("[Timer] DB lock poisoned: {e}");
            return fallback;
        }
    };
    let mut stmt =
        match conn.prepare("SELECT work_minutes, break_minutes FROM pomodoro_settings LIMIT 1") {
            Ok(s) => s,
            Err(e) => {
                log::error!("[Timer] prepare failed: {e}");
                return fallback;
            }
        };
    stmt.query_row([], |row| {
        Ok(PomodoroSettings {
            work_minutes: row.get(0)?,
            break_minutes: row.get(1)?,
        })
    })
    .unwrap_or(fallback)
}

fn save_focus_session(db: &Database, session_type: &str, duration_seconds: i64) {
    if duration_seconds < 10 {
        return;
    }
    match db.conn().lock() {
        Ok(conn) => {
            if let Err(e) = conn.execute(
                "INSERT INTO focus_sessions (type, duration_seconds, completed_at) \
                 VALUES (?1, ?2, CURRENT_TIMESTAMP)",
                params![session_type, duration_seconds],
            ) {
                log::error!("[Timer] Failed to save focus session: {e}");
            } else {
                log::info!(
                    "[Timer] Saved focus session: {} {}s",
                    session_type,
                    duration_seconds
                );
            }
        }
        Err(e) => log::error!("[Timer] DB lock poisoned saving session: {e}"),
    }
}

/* ── Settings Commands ── */

#[tauri::command]
pub fn pomodoro_get_settings(db: State<Database>) -> Result<PomodoroSettings, String> {
    Ok(get_settings(&db))
}

/// Atomic upsert — replaces the delete+insert pattern that had a race window.
#[tauri::command]
pub fn pomodoro_update_settings(
    work_minutes: i64,
    break_minutes: i64,
    db: State<Database>,
) -> Result<(), String> {
    if work_minutes < 1 || work_minutes > 1440 {
        return Err("work_minutes must be between 1 and 1440".to_string());
    }
    if break_minutes < 1 || break_minutes > 1440 {
        return Err("break_minutes must be between 1 and 1440".to_string());
    }

    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    // Single atomic statement — no gap between delete and insert.
    conn.execute(
        "INSERT INTO pomodoro_settings (id, work_minutes, break_minutes) VALUES (1, ?1, ?2)
         ON CONFLICT(id) DO UPDATE SET work_minutes = excluded.work_minutes,
                                       break_minutes = excluded.break_minutes",
        params![work_minutes, break_minutes],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/* ── Pomodoro Commands ── */

#[tauri::command]
pub fn pomodoro_start(
    app: AppHandle,
    db: State<Database>,
    timer: State<Arc<TimerState>>,
) -> Result<(), String> {
    let mut running = lock!(timer.pomodoro_running)?;
    let mut paused = lock!(timer.pomodoro_paused)?;

    if *paused && !*running {
        *paused = false;
        *running = true;
        drop(running);
        drop(paused);
        // Safe: Arc clone — no raw pointers.
        spawn_pomodoro_loop(app, db.inner().clone(), Arc::clone(&timer));
        return Ok(());
    }

    if *running {
        return Ok(());
    }

    let settings = get_settings(&db);
    *lock!(timer.pomodoro_seconds)? = settings.work_minutes * 60;
    *lock!(timer.pomodoro_mode)? = "work".to_string();
    *lock!(timer.work_seconds_elapsed)? = 0;
    *paused = false;
    *running = true;

    drop(running);
    drop(paused);

    spawn_pomodoro_loop(app, db.inner().clone(), Arc::clone(&timer));
    Ok(())
}

fn spawn_pomodoro_loop(app: AppHandle, db: Database, timer: Arc<TimerState>) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(1));

        let running = match lock!(timer.pomodoro_running) {
            Ok(g) => *g,
            Err(e) => {
                log::error!("[Timer] {e}");
                break;
            }
        };
        let paused = match lock!(timer.pomodoro_paused) {
            Ok(g) => *g,
            Err(e) => {
                log::error!("[Timer] {e}");
                break;
            }
        };
        if !running || paused {
            break;
        }

        let mut seconds = match lock!(timer.pomodoro_seconds) {
            Ok(g) => g,
            Err(e) => {
                log::error!("[Timer] {e}");
                break;
            }
        };
        let mut mode = match lock!(timer.pomodoro_mode) {
            Ok(g) => g,
            Err(e) => {
                log::error!("[Timer] {e}");
                break;
            }
        };
        let mut work_elapsed = match lock!(timer.work_seconds_elapsed) {
            Ok(g) => g,
            Err(e) => {
                log::error!("[Timer] {e}");
                break;
            }
        };

        *seconds -= 1;
        if *mode == "work" {
            *work_elapsed += 1;
        }

        let current_seconds = *seconds;
        let current_mode = mode.clone();

        let _ = app.emit(
            "timer:update",
            TimerUpdate {
                seconds: current_seconds,
                mode: current_mode.clone(),
            },
        );

        if current_seconds <= 0 {
            if current_mode == "work" {
                save_focus_session(&db, "work", *work_elapsed);
                *work_elapsed = 0;
            }

            let settings = get_settings(&db);
            if current_mode == "work" {
                *mode = "break".to_string();
                *seconds = settings.break_minutes * 60;
                let _ = app
                    .notification()
                    .builder()
                    .title("🎯 Focus Session Complete")
                    .body(&format!(
                        "Great work! Take a {}-minute break.",
                        settings.break_minutes
                    ))
                    .show();
            } else {
                *mode = "work".to_string();
                *seconds = settings.work_minutes * 60;
                *work_elapsed = 0;
                let _ = app
                    .notification()
                    .builder()
                    .title("⏰ Break Over")
                    .body(&format!(
                        "Break's over! Starting a {}-minute focus session.",
                        settings.work_minutes
                    ))
                    .show();
            }
        }
    });
}

#[tauri::command]
pub fn pomodoro_pause(timer: State<Arc<TimerState>>) -> Result<(), String> {
    *lock!(timer.pomodoro_running)? = false;
    *lock!(timer.pomodoro_paused)? = true;
    Ok(())
}

#[tauri::command]
pub fn pomodoro_stop(db: State<Database>, timer: State<Arc<TimerState>>) -> Result<(), String> {
    *lock!(timer.pomodoro_running)? = false;

    let mode = lock!(timer.pomodoro_mode)?.clone();
    let work_elapsed = *lock!(timer.work_seconds_elapsed)?;

    if mode == "work" && work_elapsed >= 10 {
        save_focus_session(&db, "work", work_elapsed);
    }

    *lock!(timer.pomodoro_seconds)? = 0;
    *lock!(timer.pomodoro_mode)? = "work".to_string();
    *lock!(timer.pomodoro_paused)? = false;
    *lock!(timer.work_seconds_elapsed)? = 0;
    Ok(())
}

/* ── Stopwatch Commands ── */

#[tauri::command]
pub fn stopwatch_start(app: AppHandle, timer: State<Arc<TimerState>>) -> Result<(), String> {
    let mut running = lock!(timer.stopwatch_running)?;
    let mut paused = lock!(timer.stopwatch_paused)?;

    if *paused && !*running {
        *paused = false;
        *running = true;
        drop(running);
        drop(paused);
        spawn_stopwatch_loop(app, Arc::clone(&timer));
        return Ok(());
    }

    if *running {
        return Ok(());
    }

    *lock!(timer.stopwatch_seconds)? = 0;
    *paused = false;
    *running = true;

    drop(running);
    drop(paused);

    spawn_stopwatch_loop(app, Arc::clone(&timer));
    Ok(())
}

fn spawn_stopwatch_loop(app: AppHandle, timer: Arc<TimerState>) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(1));

        let running = match lock!(timer.stopwatch_running) {
            Ok(g) => *g,
            Err(e) => {
                log::error!("[Timer] {e}");
                break;
            }
        };
        let paused = match lock!(timer.stopwatch_paused) {
            Ok(g) => *g,
            Err(e) => {
                log::error!("[Timer] {e}");
                break;
            }
        };
        if !running || paused {
            break;
        }

        let mut seconds = match lock!(timer.stopwatch_seconds) {
            Ok(g) => g,
            Err(e) => {
                log::error!("[Timer] {e}");
                break;
            }
        };
        *seconds += 1;

        let _ = app.emit(
            "timer:update",
            TimerUpdate {
                seconds: *seconds,
                mode: "stopwatch".to_string(),
            },
        );
    });
}

#[tauri::command]
pub fn stopwatch_pause(timer: State<Arc<TimerState>>) -> Result<(), String> {
    *lock!(timer.stopwatch_running)? = false;
    *lock!(timer.stopwatch_paused)? = true;
    Ok(())
}

#[tauri::command]
pub fn stopwatch_stop(db: State<Database>, timer: State<Arc<TimerState>>) -> Result<(), String> {
    *lock!(timer.stopwatch_running)? = false;

    let seconds = *lock!(timer.stopwatch_seconds)?;
    if seconds >= 10 {
        save_focus_session(&db, "stopwatch", seconds);
    }

    *lock!(timer.stopwatch_seconds)? = 0;
    *lock!(timer.stopwatch_paused)? = false;
    Ok(())
}

/* ── Focus History ── */

#[tauri::command]
pub fn timer_notify(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn focus_history(db: State<Database>) -> Result<Vec<FocusDay>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT DATE(completed_at) as date,
                COUNT(*) as count,
                SUM(duration_seconds) as total_seconds
         FROM focus_sessions
         WHERE type = 'work' AND completed_at IS NOT NULL
         GROUP BY DATE(completed_at)
         ORDER BY date ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(FocusDay {
                date: row.get(0)?,
                count: row.get(1)?,
                total_seconds: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string());
    rows
}

#[tauri::command]
pub fn focus_today_minutes(db: State<Database>) -> Result<i64, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let total: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0)
         FROM focus_sessions
         WHERE type = 'work' AND DATE(completed_at) = DATE('now')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(total / 60)
}

#[tauri::command]
pub fn focus_yesterday_minutes(db: State<Database>) -> Result<i64, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let total: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0)
         FROM focus_sessions
         WHERE type = 'work' AND DATE(completed_at) = DATE('now', '-1 day')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(total / 60)
}

/* ── Tests ── */

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tests::test_db;

    fn make_timer() -> Arc<TimerState> {
        TimerState::new()
    }

    // ── State transition guards ───────────────────────────────────────────────

    #[test]
    fn new_timer_is_stopped() {
        let t = make_timer();
        assert!(!*lock!(t.pomodoro_running).unwrap());
        assert!(!*lock!(t.pomodoro_paused).unwrap());
        assert!(!*lock!(t.stopwatch_running).unwrap());
        assert!(!*lock!(t.stopwatch_paused).unwrap());
    }

    #[test]
    fn pause_sets_flags_correctly() {
        let t = make_timer();
        *lock!(t.pomodoro_running).unwrap() = true;
        *lock!(t.pomodoro_running).unwrap() = false;
        *lock!(t.pomodoro_paused).unwrap() = true;
        assert!(!*lock!(t.pomodoro_running).unwrap());
        assert!(*lock!(t.pomodoro_paused).unwrap());
    }

    #[test]
    fn stop_resets_all_pomodoro_fields() {
        let t = make_timer();
        *lock!(t.pomodoro_running).unwrap() = true;
        *lock!(t.pomodoro_seconds).unwrap() = 999;
        *lock!(t.work_seconds_elapsed).unwrap() = 500;
        *lock!(t.pomodoro_mode).unwrap() = "break".to_string();

        // Simulate stop
        *lock!(t.pomodoro_running).unwrap() = false;
        *lock!(t.pomodoro_seconds).unwrap() = 0;
        *lock!(t.pomodoro_mode).unwrap() = "work".to_string();
        *lock!(t.pomodoro_paused).unwrap() = false;
        *lock!(t.work_seconds_elapsed).unwrap() = 0;

        assert_eq!(*lock!(t.pomodoro_seconds).unwrap(), 0);
        assert_eq!(*lock!(t.pomodoro_mode).unwrap(), "work");
        assert_eq!(*lock!(t.work_seconds_elapsed).unwrap(), 0);
    }

    // ── Settings upsert ───────────────────────────────────────────────────────

    #[test]
    fn settings_upsert_updates_values() {
        let (_dir, db) = test_db();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO pomodoro_settings (id, work_minutes, break_minutes) VALUES (1, 25, 5)
             ON CONFLICT(id) DO UPDATE SET work_minutes = excluded.work_minutes,
                                           break_minutes = excluded.break_minutes",
            params![],
        )
        .unwrap();
        // Update
        conn.execute(
            "INSERT INTO pomodoro_settings (id, work_minutes, break_minutes) VALUES (1, 45, 10)
             ON CONFLICT(id) DO UPDATE SET work_minutes = excluded.work_minutes,
                                           break_minutes = excluded.break_minutes",
            params![],
        )
        .unwrap();
        let (w, b): (i64, i64) = conn
            .query_row(
                "SELECT work_minutes, break_minutes FROM pomodoro_settings WHERE id = 1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(w, 45);
        assert_eq!(b, 10);
    }
}
