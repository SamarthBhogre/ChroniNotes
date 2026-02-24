use serde::{Deserialize, Serialize};
use rusqlite::params;
use tauri::State;
use crate::db::Database;

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

fn row_to_event(row: &rusqlite::Row) -> rusqlite::Result<CalendarEvent> {
    Ok(CalendarEvent {
        id: row.get(0)?,
        title: row.get(1)?,
        event_type: row.get(2)?,
        date: row.get(3)?,
        start_time: row.get(4)?,
        end_time: row.get(5)?,
        duration_minutes: row.get(6)?,
        color: row.get(7)?,
        notes: row.get(8)?,
        task_id: row.get(9)?,
        created_at: row.get(10)?,
    })
}

#[tauri::command]
pub fn calendar_create(event: CreateEventPayload, db: State<Database>) -> Result<CalendarEvent, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let event_type = event.event_type.unwrap_or_else(|| "event".to_string());
    let color = event.color.unwrap_or_else(|| "accent".to_string());

    conn.execute(
        "INSERT INTO calendar_events (title, type, date, start_time, end_time, duration_minutes, color, notes, task_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            event.title,
            event_type,
            event.date,
            event.start_time,
            event.end_time,
            event.duration_minutes,
            color,
            event.notes,
            event.task_id,
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn
        .prepare("SELECT id, title, type, date, start_time, end_time, duration_minutes, color, notes, task_id, created_at FROM calendar_events WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    stmt.query_row(params![id], row_to_event)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn calendar_list(month: Option<String>, db: State<Database>) -> Result<Vec<CalendarEvent>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    match month {
        Some(m) => {
            let pattern = format!("{}%", m);
            let mut stmt = conn
                .prepare("SELECT id, title, type, date, start_time, end_time, duration_minutes, color, notes, task_id, created_at FROM calendar_events WHERE date LIKE ?1 ORDER BY date ASC, start_time ASC")
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![pattern], row_to_event)
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            Ok(rows)
        }
        None => {
            let mut stmt = conn
                .prepare("SELECT id, title, type, date, start_time, end_time, duration_minutes, color, notes, task_id, created_at FROM calendar_events ORDER BY date ASC, start_time ASC")
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], row_to_event)
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            Ok(rows)
        }
    }
}

#[tauri::command]
pub fn calendar_list_by_date(date: String, db: State<Database>) -> Result<Vec<CalendarEvent>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, type, date, start_time, end_time, duration_minutes, color, notes, task_id, created_at FROM calendar_events WHERE date = ?1 ORDER BY start_time ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![date], row_to_event)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn calendar_list_by_range(from: String, to: String, db: State<Database>) -> Result<Vec<CalendarEvent>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, type, date, start_time, end_time, duration_minutes, color, notes, task_id, created_at FROM calendar_events WHERE date >= ?1 AND date <= ?2 ORDER BY date ASC, start_time ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![from, to], row_to_event)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn calendar_update(payload: UpdateEventPayload, db: State<Database>) -> Result<Option<CalendarEvent>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Build dynamic SET clause
    let mut set_parts: Vec<String> = Vec::new();
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
    }
    if let Some(ref v) = payload.start_time {
        set_parts.push("start_time = ?".to_string());
        values.push(Box::new(v.clone()));
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

    if set_parts.is_empty() {
        return Ok(None);
    }

    let sql = format!(
        "UPDATE calendar_events SET {} WHERE id = ?",
        set_parts.join(", ")
    );
    values.push(Box::new(payload.id));

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params_refs.as_slice())
        .map_err(|e| e.to_string())?;

    // Return updated event
    let mut stmt = conn
        .prepare("SELECT id, title, type, date, start_time, end_time, duration_minutes, color, notes, task_id, created_at FROM calendar_events WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let event = stmt
        .query_row(params![payload.id], row_to_event)
        .ok();
    Ok(event)
}

#[tauri::command]
pub fn calendar_delete(id: i64, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM calendar_events WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn calendar_active_dates(month: String, db: State<Database>) -> Result<Vec<ActiveDate>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let pattern = format!("{}%", month);
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT date, type FROM calendar_events WHERE date LIKE ?1 ORDER BY date ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![pattern], |row| {
            Ok(ActiveDate {
                date: row.get(0)?,
                event_type: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}
