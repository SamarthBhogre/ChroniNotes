use serde::{Deserialize, Serialize};
use rusqlite::params;
use tauri::State;
use chrono::{NaiveDate, NaiveTime};
use crate::db::Database;

/* ── Types ── */

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarEvent {
    pub id: i64,
    pub title: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub date: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub duration_minutes: Option<i64>,
    pub color: Option<String>,
    pub notes: Option<String>,
    pub task_id: Option<i64>,
    pub reminder_minutes: Option<i64>,
    pub notified: Option<i64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEventPayload {
    pub title: String,
    #[serde(rename = "type")]
    pub event_type: Option<String>,
    pub date: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub duration_minutes: Option<i64>,
    pub color: Option<String>,
    pub notes: Option<String>,
    pub task_id: Option<i64>,
    pub reminder_minutes: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEventPayload {
    pub id: i64,
    pub title: Option<String>,
    #[serde(rename = "type")]
    pub event_type: Option<String>,
    pub date: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub duration_minutes: Option<i64>,
    pub color: Option<String>,
    pub notes: Option<String>,
    pub task_id: Option<i64>,
    pub reminder_minutes: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActiveDate {
    pub date: String,
    #[serde(rename = "type")]
    pub event_type: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct DateRange {
    pub from: String,
    pub to: String,
}

/* ── Validation helpers ── */

const VALID_EVENT_TYPES: &[&str] = &["event", "reminder", "focus", "task"];

fn validate_title(title: &str) -> Result<(), String> {
    if title.trim().is_empty() {
        return Err("Event title must not be empty".to_string());
    }
    if title.len() > 500 {
        return Err("Event title exceeds 500 characters".to_string());
    }
    Ok(())
}

/// Validate a date string: must match the *exact* YYYY-MM-DD digit pattern
/// **and** represent a real calendar date according to chrono.
///
/// Two-stage check:
///   1. Format gate — `regex-lite` ensures exactly 4-2-2 digits separated by
///      hyphens.  (chrono's `parse_from_str("%Y-%m-%d")` accepts single-digit
///      month/day, so we can't rely on it alone for the format invariant.)
///   2. Semantic gate — chrono rejects impossible dates like 2024-02-30 or
///      2023-02-29 (non-leap year).
fn validate_date(date: &str) -> Result<(), String> {
    // Stage 1: strict digit-pattern check.
    let re = regex_lite::Regex::new(r"^\d{4}-\d{2}-\d{2}$").unwrap();
    if !re.is_match(date) {
        return Err(format!(
            "Date '{}' must be in YYYY-MM-DD format (four-digit year, two-digit month and day)",
            date
        ));
    }
    // Stage 2: real calendar date check.
    NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| format!(
            "Date '{}' is not a valid calendar date (e.g. Feb 30 or month 13 are rejected)",
            date
        ))
}

/// Validate a time string: accept HH:MM or HH:MM:SS with *exactly* two
/// digits in each component, and a real clock value (00-23 / 00-59).
///
/// Two-stage check (same reasoning as `validate_date`):
///   1. Format gate — `regex-lite` enforces the two-digit invariant.
///   2. Semantic gate — chrono rejects out-of-range components like 25:00.
fn validate_time(t: &str) -> Result<(), String> {
    // Stage 1: strict two-digit format.
    let re = regex_lite::Regex::new(r"^\d{2}:\d{2}(:\d{2})?$").unwrap();
    if !re.is_match(t) {
        return Err(format!(
            "Time '{}' must be HH:MM or HH:MM:SS with two-digit components",
            t
        ));
    }
    // Stage 2: real clock value check.
    let ok = NaiveTime::parse_from_str(t, "%H:%M:%S").is_ok()
        || NaiveTime::parse_from_str(t, "%H:%M").is_ok();
    if ok {
        Ok(())
    } else {
        Err(format!(
            "Time '{}' is not a valid clock time (hours 00-23, minutes/seconds 00-59)",
            t
        ))
    }
}

fn validate_event_type(et: &str) -> Result<(), String> {
    if !VALID_EVENT_TYPES.contains(&et) {
        return Err(format!(
            "Invalid event type '{}'. Allowed: {}",
            et,
            VALID_EVENT_TYPES.join(", ")
        ));
    }
    Ok(())
}

fn validate_duration(d: i64) -> Result<(), String> {
    if d <= 0 {
        return Err(format!("duration_minutes must be > 0, got {d}"));
    }
    Ok(())
}

fn validate_reminder(r: i64) -> Result<(), String> {
    if r < 0 {
        return Err(format!("reminder_minutes must be >= 0, got {r}"));
    }
    Ok(())
}

/* ── Row mapper ── */

fn row_to_event(row: &rusqlite::Row) -> rusqlite::Result<CalendarEvent> {
    Ok(CalendarEvent {
        id:               row.get(0)?,
        title:            row.get(1)?,
        event_type:       row.get(2)?,
        date:             row.get(3)?,
        start_time:       row.get(4)?,
        end_time:         row.get(5)?,
        duration_minutes: row.get(6)?,
        color:            row.get(7)?,
        notes:            row.get(8)?,
        task_id:          row.get(9)?,
        reminder_minutes: row.get(10)?,
        notified:         row.get(11)?,
        created_at:       row.get(12)?,
    })
}

const SELECT_COLS: &str =
    "id, title, type, date, start_time, end_time, duration_minutes, \
     color, notes, task_id, reminder_minutes, notified, created_at";

/* ── Commands ── */

// All command logic lives in `pub(crate) fn *_inner(db: &Database, ...)`.
// The `#[tauri::command]` functions are thin wrappers so the core logic is
// fully unit-testable without Tauri's State machinery.

pub(crate) fn calendar_create_inner(
    event: CreateEventPayload,
    db: &Database,
) -> Result<CalendarEvent, String> {
    validate_title(&event.title)?;
    validate_date(&event.date)?;

    let event_type = event.event_type.unwrap_or_else(|| "event".to_string());
    validate_event_type(&event_type)?;

    if let Some(ref t) = event.start_time { validate_time(t)?; }
    if let Some(ref t) = event.end_time   { validate_time(t)?; }
    if let Some(d) = event.duration_minutes { validate_duration(d)?; }
    if let Some(r) = event.reminder_minutes { validate_reminder(r)?; }

    let color = event.color.unwrap_or_else(|| "accent".to_string());

    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO calendar_events \
         (title, type, date, start_time, end_time, duration_minutes, color, notes, task_id, reminder_minutes) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            event.title, event_type, event.date,
            event.start_time, event.end_time, event.duration_minutes,
            color, event.notes, event.task_id, event.reminder_minutes,
        ],
    )
    .map_err(|e| e.to_string())?;

    let id  = conn.last_insert_rowid();
    let sql = format!("SELECT {} FROM calendar_events WHERE id = ?1", SELECT_COLS);
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    stmt.query_row(params![id], row_to_event).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn calendar_create(
    event: CreateEventPayload,
    db: State<Database>,
) -> Result<CalendarEvent, String> {
    calendar_create_inner(event, db.inner())
}

#[tauri::command]
pub fn calendar_list(
    month: Option<String>,
    db: State<Database>,
) -> Result<Vec<CalendarEvent>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let rows: Vec<CalendarEvent> = match month {
        Some(m) => {
            let pattern = format!("{}%", m);
            let sql = format!(
                "SELECT {} FROM calendar_events WHERE date LIKE ?1 \
                 ORDER BY date ASC, start_time ASC",
                SELECT_COLS
            );
            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let rows = stmt.query_map(params![pattern], row_to_event)
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            rows
        }
        None => {
            let sql = format!(
                "SELECT {} FROM calendar_events ORDER BY date ASC, start_time ASC",
                SELECT_COLS
            );
            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let rows = stmt.query_map([], row_to_event)
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            rows
        }
    };
    Ok(rows)
}

#[tauri::command]
pub fn calendar_list_by_date(
    date: String,
    db: State<Database>,
) -> Result<Vec<CalendarEvent>, String> {
    validate_date(&date)?;
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let sql  = format!(
        "SELECT {} FROM calendar_events WHERE date = ?1 ORDER BY start_time ASC",
        SELECT_COLS
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![date], row_to_event)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string());
    rows
}

#[tauri::command]
pub fn calendar_list_by_range(
    from: String,
    to: String,
    db: State<Database>,
) -> Result<Vec<CalendarEvent>, String> {
    validate_date(&from)?;
    validate_date(&to)?;
    if from > to {
        return Err(format!("from date '{}' must be <= to date '{}'", from, to));
    }
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let sql  = format!(
        "SELECT {} FROM calendar_events \
         WHERE date >= ?1 AND date <= ?2 ORDER BY date ASC, start_time ASC",
        SELECT_COLS
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![from, to], row_to_event)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string());
    rows
}

pub(crate) fn calendar_update_inner(
    payload: UpdateEventPayload,
    db: &Database,
) -> Result<CalendarEvent, String> {
    // Validate every provided field before touching the DB.
    if let Some(ref t) = payload.title       { validate_title(t)?; }
    if let Some(ref et) = payload.event_type  { validate_event_type(et)?; }
    if let Some(ref d) = payload.date        { validate_date(d)?; }
    if let Some(ref t) = payload.start_time  { validate_time(t)?; }
    if let Some(ref t) = payload.end_time    { validate_time(t)?; }
    if let Some(d) = payload.duration_minutes { validate_duration(d)?; }
    if let Some(r) = payload.reminder_minutes { validate_reminder(r)?; }

    let mut set_parts: Vec<String>                = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref v) = payload.title {
        set_parts.push("title = ?".to_string());
        values.push(Box::new(v.clone()));
    }
    if let Some(ref v) = payload.event_type {
        set_parts.push("type = ?".to_string());
        values.push(Box::new(v.clone()));
    }
    if let Some(ref v) = payload.date {
        set_parts.push("date = ?".to_string());
        values.push(Box::new(v.clone()));
        set_parts.push("notified = 0".to_string());
    }
    if let Some(ref v) = payload.start_time {
        set_parts.push("start_time = ?".to_string());
        values.push(Box::new(v.clone()));
        set_parts.push("notified = 0".to_string());
    }
    if let Some(ref v) = payload.end_time {
        set_parts.push("end_time = ?".to_string());
        values.push(Box::new(v.clone()));
    }
    if let Some(v) = payload.duration_minutes {
        set_parts.push("duration_minutes = ?".to_string());
        values.push(Box::new(v));
    }
    if let Some(ref v) = payload.color {
        set_parts.push("color = ?".to_string());
        values.push(Box::new(v.clone()));
    }
    if let Some(ref v) = payload.notes {
        set_parts.push("notes = ?".to_string());
        values.push(Box::new(v.clone()));
    }
    if let Some(v) = payload.task_id {
        set_parts.push("task_id = ?".to_string());
        values.push(Box::new(v));
    }
    if let Some(v) = payload.reminder_minutes {
        set_parts.push("reminder_minutes = ?".to_string());
        set_parts.push("notified = 0".to_string());
        values.push(Box::new(v));
    }

    if set_parts.is_empty() {
        // Nothing to update — fetch and return current state.
        let conn = db.conn().lock().map_err(|e| e.to_string())?;
        let sql  = format!("SELECT {} FROM calendar_events WHERE id = ?1", SELECT_COLS);
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        return stmt
            .query_row(params![payload.id], row_to_event)
            .map_err(|_| format!("Event {} not found", payload.id));
    }

    let sql = format!(
        "UPDATE calendar_events SET {} WHERE id = ?",
        set_parts.join(", ")
    );
    values.push(Box::new(payload.id));

    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::types::ToSql> =
        values.iter().map(|v| v.as_ref()).collect();
    let affected = conn
        .execute(&sql, params_refs.as_slice())
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err(format!("Event {} not found", payload.id));
    }

    let select_sql = format!("SELECT {} FROM calendar_events WHERE id = ?1", SELECT_COLS);
    let mut stmt = conn.prepare(&select_sql).map_err(|e| e.to_string())?;
    stmt.query_row(params![payload.id], row_to_event)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn calendar_update(
    payload: UpdateEventPayload,
    db: State<Database>,
) -> Result<CalendarEvent, String> {
    calendar_update_inner(payload, db.inner())
}

pub(crate) fn calendar_delete_inner(id: i64, db: &Database) -> Result<(), String> {
    let conn     = db.conn().lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute("DELETE FROM calendar_events WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err(format!("Event {} not found", id));
    }
    Ok(())
}

#[tauri::command]
pub fn calendar_delete(id: i64, db: State<Database>) -> Result<(), String> {
    calendar_delete_inner(id, db.inner())
}

#[tauri::command]
pub fn calendar_active_dates(
    month: String,
    db: State<Database>,
) -> Result<Vec<ActiveDate>, String> {
    let conn    = db.conn().lock().map_err(|e| e.to_string())?;
    let pattern = format!("{}%", month);
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT date, type FROM calendar_events \
             WHERE date LIKE ?1 ORDER BY date ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![pattern], |row| {
        Ok(ActiveDate { date: row.get(0)?, event_type: row.get(1)? })
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string());
    rows
}

/* ── Internal helpers (used by notifications) ── */

/// Return events whose reminder window opens within [yesterday, tomorrow] of
/// `local_today` (YYYY-MM-DD in the caller's timezone) that have not yet fired.
pub fn get_pending_notifications(
    db: &Database,
    local_today: &str,
) -> Result<Vec<CalendarEvent>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let sql  = format!(
        "SELECT {} FROM calendar_events \
         WHERE reminder_minutes IS NOT NULL \
           AND (notified IS NULL OR notified = 0) \
           AND start_time IS NOT NULL \
           AND date >= DATE(?1, '-1 day') \
           AND date <= DATE(?1, '+1 day')",
        SELECT_COLS
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![local_today], row_to_event)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string());
    rows
}

/// Mark a single event as notified. Errors are logged, not propagated —
/// a missed mark just means a duplicate notification next cycle, which is
/// preferable to crashing the scheduler.
pub fn mark_notified(db: &Database, id: i64) {
    match db.conn().lock() {
        Ok(conn) => {
            if let Err(e) = conn.execute(
                "UPDATE calendar_events SET notified = 1 WHERE id = ?1",
                params![id],
            ) {
                log::error!("[Calendar] mark_notified failed for event #{id}: {e}");
            }
        }
        Err(e) => log::error!("[Calendar] DB lock poisoned in mark_notified: {e}"),
    }
}

/* ── Tests ── */

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tests::test_db;
    use rusqlite::params;

    fn insert_event(db: &Database, date: &str, start_time: &str, reminder_minutes: i64) -> i64 {
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO calendar_events (title, type, date, start_time, reminder_minutes, notified)
             VALUES ('Test', 'event', ?1, ?2, ?3, 0)",
            params![date, start_time, reminder_minutes],
        ).unwrap();
        conn.last_insert_rowid()
    }

    // ── Validation ────────────────────────────────────────────────────────────

    #[test]
    fn date_format_valid() {
        assert!(validate_date("2024-06-15").is_ok());
        assert!(validate_date("2000-01-01").is_ok());
        assert!(validate_date("2024-02-29").is_ok()); // 2024 is a leap year
    }

    #[test]
    fn date_format_invalid() {
        assert!(validate_date("15/06/2024").is_err());
        assert!(validate_date("2024-6-1").is_err());
        assert!(validate_date("not-a-date").is_err());
    }

    /// chrono must reject calendar-impossible values even though they match
    /// the YYYY-MM-DD digit pattern.
    #[test]
    fn date_impossible_values_rejected() {
        assert!(validate_date("2026-99-99").is_err(), "month 99 must fail");
        assert!(validate_date("2026-00-01").is_err(), "month 0 must fail");
        assert!(validate_date("2026-13-01").is_err(), "month 13 must fail");
        assert!(validate_date("2024-02-30").is_err(), "Feb 30 must fail");
        assert!(validate_date("2023-02-29").is_err(), "Feb 29 non-leap must fail");
    }

    #[test]
    fn time_format_hhmm() {
        assert!(validate_time("09:30").is_ok());
        assert!(validate_time("23:59").is_ok());
        assert!(validate_time("00:00").is_ok());
    }

    #[test]
    fn time_format_hhmmss() {
        assert!(validate_time("09:30:00").is_ok());
        assert!(validate_time("23:59:59").is_ok());
    }

    #[test]
    fn time_format_invalid() {
        assert!(validate_time("9:30").is_err(),  "single-digit hour must fail");
        assert!(validate_time("9:3").is_err(),   "single-digit min must fail");
        assert!(validate_time("noon").is_err(),  "text must fail");
    }

    /// chrono must reject out-of-range time components even if the format is
    /// superficially correct (two digits each side of colons).
    #[test]
    fn time_impossible_values_rejected() {
        assert!(validate_time("25:00").is_err(), "hour 25 must fail");
        assert!(validate_time("24:00").is_err(), "hour 24 must fail");
        assert!(validate_time("12:60").is_err(), "minute 60 must fail");
        assert!(validate_time("12:99").is_err(), "minute 99 must fail");
        assert!(validate_time("29:88").is_err(), "29:88 must fail");
    }

    #[test]
    fn valid_event_types_accepted() {
        for et in VALID_EVENT_TYPES {
            assert!(validate_event_type(et).is_ok(), "should accept: {et}");
        }
    }

    #[test]
    fn invalid_event_type_rejected() {
        assert!(validate_event_type("meeting").is_err());
        assert!(validate_event_type("").is_err());
        assert!(validate_event_type("EVENT").is_err());
    }

    #[test]
    fn reminder_negative_rejected() {
        assert!(validate_reminder(-1).is_err());
        assert!(validate_reminder(0).is_ok());
        assert!(validate_reminder(15).is_ok());
    }

    #[test]
    fn duration_zero_rejected() {
        assert!(validate_duration(0).is_err());
        assert!(validate_duration(-1).is_err());
        assert!(validate_duration(1).is_ok());
    }

    // ── Reminder query / timing logic ─────────────────────────────────────────

    /// An unnotified event with reminder on the same day as `local_today`
    /// must appear in `get_pending_notifications`.
    #[test]
    fn pending_notifications_returns_unnotified_event() {
        let (_dir, db) = test_db();
        insert_event(&db, "2024-06-15", "14:00", 15);
        let events = get_pending_notifications(&db, "2024-06-15").unwrap();
        assert_eq!(events.len(), 1, "Expected 1 pending event");
        assert_eq!(events[0].date, "2024-06-15");
    }

    /// After `mark_notified`, the same event must NOT appear again.
    #[test]
    fn mark_notified_prevents_repeat() {
        let (_dir, db) = test_db();
        let id = insert_event(&db, "2024-06-15", "14:00", 15);
        mark_notified(&db, id);
        let events = get_pending_notifications(&db, "2024-06-15").unwrap();
        assert!(events.is_empty(), "Notified event must not reappear");
    }

    /// An event two days away must NOT be in the notification window.
    #[test]
    fn event_outside_window_not_returned() {
        let (_dir, db) = test_db();
        insert_event(&db, "2024-06-17", "14:00", 15);
        let events = get_pending_notifications(&db, "2024-06-15").unwrap();
        assert!(events.is_empty(), "Out-of-window event should not appear");
    }

    /// An event with no reminder set must not appear.
    #[test]
    fn event_without_reminder_not_returned() {
        let (_dir, db) = test_db();
        {
            let conn = db.conn().lock().unwrap();
            conn.execute(
                "INSERT INTO calendar_events (title, type, date, start_time, notified)
                 VALUES ('NoReminder', 'event', '2024-06-15', '14:00', 0)",
                [],
            ).unwrap();
        }
        let events = get_pending_notifications(&db, "2024-06-15").unwrap();
        assert!(events.is_empty(), "Event without reminder must not appear");
    }

    // ── Command-level contract tests ─────────────────────────────────────────

    fn make_event(date: &str) -> CreateEventPayload {
        CreateEventPayload {
            title: "Contract test".to_string(),
            event_type: None,
            date: date.to_string(),
            start_time: Some("10:00".to_string()),
            end_time: None,
            duration_minutes: None,
            color: None,
            notes: None,
            task_id: None,
            reminder_minutes: None,
        }
    }

    /// `calendar_create_inner` must reject an impossible date before inserting.
    #[test]
    fn command_create_rejects_impossible_date() {
        let (_dir, db) = test_db();
        let err = calendar_create_inner(make_event("2026-99-99"), &db).unwrap_err();
        assert!(
            err.contains("2026-99-99") || err.contains("valid"),
            "unexpected error: {err}"
        );
    }

    /// A valid creation must return the inserted event with the correct fields.
    #[test]
    fn command_create_valid_event_returns_event() {
        let (_dir, db) = test_db();
        let evt = calendar_create_inner(make_event("2025-06-15"), &db).unwrap();
        assert_eq!(evt.date, "2025-06-15");
        assert_eq!(evt.title, "Contract test");
        assert_eq!(evt.event_type, "event");
        assert!(evt.id > 0);
    }

    /// `calendar_create_inner` must reject an invalid event type.
    #[test]
    fn command_create_rejects_invalid_event_type() {
        let (_dir, db) = test_db();
        let mut p = make_event("2025-06-15");
        p.event_type = Some("meeting".to_string());
        let err = calendar_create_inner(p, &db).unwrap_err();
        assert!(err.contains("meeting") || err.contains("Invalid"), "{err}");
    }

    /// `calendar_create_inner` with an impossible time must return `Err`.
    #[test]
    fn command_create_rejects_impossible_time() {
        let (_dir, db) = test_db();
        let mut p = make_event("2025-06-15");
        p.start_time = Some("29:88".to_string());
        let err = calendar_create_inner(p, &db).unwrap_err();
        assert!(err.contains("29:88") || err.contains("valid"), "{err}");
    }

    /// `calendar_delete_inner` on a missing event ID must return `Err`.
    #[test]
    fn command_delete_missing_event_returns_err() {
        let (_dir, db) = test_db();
        let err = calendar_delete_inner(9999, &db).unwrap_err();
        assert!(err.contains("9999"), "error must mention the id: {err}");
    }

    /// `calendar_delete_inner` on an existing event must succeed.
    #[test]
    fn command_delete_existing_event() {
        let (_dir, db) = test_db();
        let evt = calendar_create_inner(make_event("2025-08-01"), &db).unwrap();
        calendar_delete_inner(evt.id, &db).unwrap();

        let conn = db.conn().lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM calendar_events WHERE id = ?1",
            params![evt.id],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(count, 0, "Event must be gone after delete");
    }

    // ── calendar_update_inner ─────────────────────────────────────────────────

    fn make_update(id: i64) -> UpdateEventPayload {
        UpdateEventPayload {
            id,
            title: None,
            event_type: None,
            date: None,
            start_time: None,
            end_time: None,
            duration_minutes: None,
            color: None,
            notes: None,
            task_id: None,
            reminder_minutes: None,
        }
    }

    /// `calendar_update_inner` on a missing event ID must return `Err`.
    #[test]
    fn command_update_missing_id_returns_err() {
        let (_dir, db) = test_db();
        let mut p = make_update(9999);
        p.title = Some("Ghost".to_string());
        let err = calendar_update_inner(p, &db).unwrap_err();
        assert!(err.contains("9999"), "error must mention the id: {err}");
    }

    /// `calendar_update_inner` with an invalid date must return `Err` before
    /// touching the DB.
    #[test]
    fn command_update_invalid_date_returns_err() {
        let (_dir, db) = test_db();
        let evt = calendar_create_inner(make_event("2025-08-01"), &db).unwrap();
        let mut p = make_update(evt.id);
        p.date = Some("not-a-date".to_string());
        let err = calendar_update_inner(p, &db).unwrap_err();
        assert!(err.contains("not-a-date") || err.contains("YYYY"), "{err}");
    }

    /// `calendar_update_inner` with an invalid event type must return `Err`.
    #[test]
    fn command_update_invalid_event_type_returns_err() {
        let (_dir, db) = test_db();
        let evt = calendar_create_inner(make_event("2025-08-01"), &db).unwrap();
        let mut p = make_update(evt.id);
        p.event_type = Some("meeting".to_string());
        let err = calendar_update_inner(p, &db).unwrap_err();
        assert!(err.contains("meeting") || err.contains("Invalid"), "{err}");
    }

    /// `calendar_update_inner` with no fields set must return the current event
    /// (no-op path).
    #[test]
    fn command_update_no_fields_returns_current_event() {
        let (_dir, db) = test_db();
        let evt = calendar_create_inner(make_event("2025-08-01"), &db).unwrap();
        let result = calendar_update_inner(make_update(evt.id), &db).unwrap();
        assert_eq!(result.id, evt.id);
        assert_eq!(result.title, "Contract test");
    }

    /// `calendar_update_inner` with a valid patch must persist and return the
    /// updated fields.
    #[test]
    fn command_update_valid_patch_persists() {
        let (_dir, db) = test_db();
        let evt = calendar_create_inner(make_event("2025-08-01"), &db).unwrap();
        let mut p = make_update(evt.id);
        p.title = Some("Updated title".to_string());
        p.date  = Some("2025-09-15".to_string());
        let result = calendar_update_inner(p, &db).unwrap();
        assert_eq!(result.title, "Updated title");
        assert_eq!(result.date,  "2025-09-15");
        // Rescheduled — notified must be reset to 0
        assert_eq!(result.notified, Some(0));
    }

    /// Updating `reminder_minutes` must reset `notified` to 0.
    #[test]
    fn command_update_reminder_resets_notified() {
        let (_dir, db) = test_db();
        let evt = calendar_create_inner(make_event("2025-08-01"), &db).unwrap();
        // Mark notified first
        mark_notified(&db, evt.id);
        // Now update reminder → should reset notified
        let mut p = make_update(evt.id);
        p.reminder_minutes = Some(30);
        let result = calendar_update_inner(p, &db).unwrap();
        assert_eq!(result.notified, Some(0), "notified must be reset after reminder change");
    }
}
