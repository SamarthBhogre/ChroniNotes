use serde::{Deserialize, Serialize};
use rusqlite::params;
use std::sync::Mutex;
use tauri::{Emitter, State, AppHandle};
use tauri_plugin_notification::NotificationExt;
use crate::db::Database;

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

pub struct TimerState {
    pub pomodoro_seconds: Mutex<i64>,
    pub pomodoro_mode: Mutex<String>,     // "work" or "break"
    pub pomodoro_running: Mutex<bool>,
    pub pomodoro_paused: Mutex<bool>,
    pub work_seconds_elapsed: Mutex<i64>,

    pub stopwatch_seconds: Mutex<i64>,
    pub stopwatch_running: Mutex<bool>,
    pub stopwatch_paused: Mutex<bool>,
}

impl TimerState {
    pub fn new() -> Self {
        TimerState {
            pomodoro_seconds: Mutex::new(0),
            pomodoro_mode: Mutex::new("work".to_string()),
            pomodoro_running: Mutex::new(false),
            pomodoro_paused: Mutex::new(false),
            work_seconds_elapsed: Mutex::new(0),

            stopwatch_seconds: Mutex::new(0),
            stopwatch_running: Mutex::new(false),
            stopwatch_paused: Mutex::new(false),
        }
    }
}

/* ── Helpers ── */

fn get_settings(db: &Database) -> PomodoroSettings {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT work_minutes, break_minutes FROM pomodoro_settings LIMIT 1")
        .unwrap();
    stmt.query_row([], |row| {
        Ok(PomodoroSettings {
            work_minutes: row.get(0).unwrap_or(25),
            break_minutes: row.get(1).unwrap_or(5),
        })
    })
    .unwrap_or(PomodoroSettings {
        work_minutes: 25,
        break_minutes: 5,
    })
}

fn save_focus_session(db: &Database, session_type: &str, duration_seconds: i64) {
    if duration_seconds < 10 {
        return;
    }
    let conn = db.conn.lock().unwrap();
    let _ = conn.execute(
        "INSERT INTO focus_sessions (type, duration_seconds, completed_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)",
        params![session_type, duration_seconds],
    );
    log::info!("[DB] Saved focus session: {} {}s", session_type, duration_seconds);
}

/* ── Settings Commands ── */

#[tauri::command]
pub fn pomodoro_get_settings(db: State<Database>) -> Result<PomodoroSettings, String> {
    Ok(get_settings(&db))
}

#[tauri::command]
pub fn pomodoro_update_settings(
    work_minutes: i64,
    break_minutes: i64,
    db: State<Database>,
) -> Result<(), String> {
    if work_minutes < 1 || break_minutes < 1 {
        return Err("Timer settings must be at least 1 minute".to_string());
    }
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM pomodoro_settings", [])
        .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO pomodoro_settings (work_minutes, break_minutes) VALUES (?1, ?2)",
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
    timer: State<TimerState>,
) -> Result<(), String> {
    let mut running = timer.pomodoro_running.lock().unwrap();
    let mut paused = timer.pomodoro_paused.lock().unwrap();

    // Resume from pause
    if *paused && !*running {
        *paused = false;
        *running = true;
        drop(running);
        drop(paused);
        spawn_pomodoro_loop(app, db.inner().clone_ref(), timer.inner().clone_ref());
        return Ok(());
    }

    if *running {
        return Ok(());
    }

    // Fresh start
    let settings = get_settings(&db);
    *timer.pomodoro_seconds.lock().unwrap() = settings.work_minutes * 60;
    *timer.pomodoro_mode.lock().unwrap() = "work".to_string();
    *timer.work_seconds_elapsed.lock().unwrap() = 0;
    *paused = false;
    *running = true;

    drop(running);
    drop(paused);

    spawn_pomodoro_loop(app, db.inner().clone_ref(), timer.inner().clone_ref());
    Ok(())
}

/// We need a clonable reference wrapper since State doesn't let us move easily
trait CloneRef {
    fn clone_ref(&self) -> &'static Self;
}

/// SAFETY: We store Database and TimerState in Tauri's managed state, 
/// which lives for the entire app lifetime. We use a raw pointer cast 
/// to get a 'static reference for the background timer thread.
impl CloneRef for Database {
    fn clone_ref(&self) -> &'static Self {
        unsafe { &*(self as *const Self) }
    }
}

impl CloneRef for TimerState {
    fn clone_ref(&self) -> &'static Self {
        unsafe { &*(self as *const Self) }
    }
}

fn spawn_pomodoro_loop(app: AppHandle, db: &'static Database, timer: &'static TimerState) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));

            let running = *timer.pomodoro_running.lock().unwrap();
            let paused = *timer.pomodoro_paused.lock().unwrap();

            if !running || paused {
                break;
            }

            let mut seconds = timer.pomodoro_seconds.lock().unwrap();
            let mut mode = timer.pomodoro_mode.lock().unwrap();
            let mut work_elapsed = timer.work_seconds_elapsed.lock().unwrap();

            *seconds -= 1;

            if *mode == "work" {
                *work_elapsed += 1;
            }

            let current_seconds = *seconds;
            let current_mode = mode.clone();

            // Emit update to frontend
            let _ = app.emit("timer:update", TimerUpdate {
                seconds: current_seconds,
                mode: current_mode.clone(),
            });

            if current_seconds <= 0 {
                // Session completed — save it
                if current_mode == "work" {
                    save_focus_session(db, "work", *work_elapsed);
                    *work_elapsed = 0;
                }

                // Flip mode
                let settings = get_settings(db);
                if current_mode == "work" {
                    *mode = "break".to_string();
                    *seconds = settings.break_minutes * 60;

                    // Send notification: work session complete
                    let _ = app.notification()
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

                    // Send notification: break over
                    let _ = app.notification()
                        .builder()
                        .title("⏰ Break Over")
                        .body(&format!(
                            "Break's over! Starting a {}-minute focus session.",
                            settings.work_minutes
                        ))
                        .show();
                }
            }
        }
    });
}

#[tauri::command]
pub fn pomodoro_pause(timer: State<TimerState>) -> Result<(), String> {
    *timer.pomodoro_running.lock().unwrap() = false;
    *timer.pomodoro_paused.lock().unwrap() = true;
    Ok(())
}

#[tauri::command]
pub fn pomodoro_stop(db: State<Database>, timer: State<TimerState>) -> Result<(), String> {
    let mut running = timer.pomodoro_running.lock().unwrap();
    *running = false;

    let mode = timer.pomodoro_mode.lock().unwrap().clone();
    let work_elapsed = *timer.work_seconds_elapsed.lock().unwrap();

    // Save partial work session
    if mode == "work" && work_elapsed >= 10 {
        save_focus_session(&db, "work", work_elapsed);
    }

    *timer.pomodoro_seconds.lock().unwrap() = 0;
    *timer.pomodoro_mode.lock().unwrap() = "work".to_string();
    *timer.pomodoro_paused.lock().unwrap() = false;
    *timer.work_seconds_elapsed.lock().unwrap() = 0;

    Ok(())
}

/* ── Stopwatch Commands ── */

#[tauri::command]
pub fn stopwatch_start(
    app: AppHandle,
    timer: State<TimerState>,
) -> Result<(), String> {
    let mut running = timer.stopwatch_running.lock().unwrap();
    let mut paused = timer.stopwatch_paused.lock().unwrap();

    // Resume from pause
    if *paused && !*running {
        *paused = false;
        *running = true;
        drop(running);
        drop(paused);
        spawn_stopwatch_loop(app, timer.inner().clone_ref());
        return Ok(());
    }

    if *running {
        return Ok(());
    }

    *timer.stopwatch_seconds.lock().unwrap() = 0;
    *paused = false;
    *running = true;

    drop(running);
    drop(paused);

    spawn_stopwatch_loop(app, timer.inner().clone_ref());
    Ok(())
}

fn spawn_stopwatch_loop(app: AppHandle, timer: &'static TimerState) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));

            let running = *timer.stopwatch_running.lock().unwrap();
            let paused = *timer.stopwatch_paused.lock().unwrap();

            if !running || paused {
                break;
            }

            let mut seconds = timer.stopwatch_seconds.lock().unwrap();
            *seconds += 1;

            let _ = app.emit("timer:update", TimerUpdate {
                seconds: *seconds,
                mode: "stopwatch".to_string(),
            });
        }
    });
}

#[tauri::command]
pub fn stopwatch_pause(timer: State<TimerState>) -> Result<(), String> {
    *timer.stopwatch_running.lock().unwrap() = false;
    *timer.stopwatch_paused.lock().unwrap() = true;
    Ok(())
}

#[tauri::command]
pub fn stopwatch_stop(db: State<Database>, timer: State<TimerState>) -> Result<(), String> {
    *timer.stopwatch_running.lock().unwrap() = false;

    let seconds = *timer.stopwatch_seconds.lock().unwrap();
    if seconds >= 10 {
        save_focus_session(&db, "stopwatch", seconds);
    }

    *timer.stopwatch_seconds.lock().unwrap() = 0;
    *timer.stopwatch_paused.lock().unwrap() = false;

    Ok(())
}

/* ── Focus History Commands ── */

#[tauri::command]
pub fn timer_notify(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn focus_history(db: State<Database>) -> Result<Vec<FocusDay>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT DATE(completed_at) as date, COUNT(*) as count, SUM(duration_seconds) as total_seconds
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
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn focus_today_minutes(db: State<Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let total: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0) FROM focus_sessions WHERE type = 'work' AND DATE(completed_at) = DATE('now')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    Ok(total / 60)
}

#[tauri::command]
pub fn focus_yesterday_minutes(db: State<Database>) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let total: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_seconds), 0) FROM focus_sessions WHERE type = 'work' AND DATE(completed_at) = DATE('now', '-1 day')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    Ok(total / 60)
}
