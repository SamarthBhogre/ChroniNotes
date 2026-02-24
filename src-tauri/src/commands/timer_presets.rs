use serde::{Deserialize, Serialize};
use rusqlite::params;
use tauri::State;
use crate::db::Database;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimerPreset {
    pub id: i64,
    pub name: String,
    pub duration_minutes: i64,
    pub is_favorite: i64,
    pub created_at: Option<String>,
}

#[tauri::command]
pub fn timer_presets_list(db: State<Database>) -> Result<Vec<TimerPreset>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, duration_minutes, is_favorite, created_at FROM timer_presets ORDER BY is_favorite DESC, created_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(TimerPreset {
                id: row.get(0)?,
                name: row.get(1)?,
                duration_minutes: row.get(2)?,
                is_favorite: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn timer_presets_create(
    name: String,
    duration_minutes: i64,
    is_favorite: bool,
    db: State<Database>,
) -> Result<TimerPreset, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let fav: i64 = if is_favorite { 1 } else { 0 };
    conn.execute(
        "INSERT INTO timer_presets (name, duration_minutes, is_favorite) VALUES (?1, ?2, ?3)",
        params![name, duration_minutes, fav],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(TimerPreset {
        id,
        name,
        duration_minutes,
        is_favorite: fav,
        created_at: None,
    })
}

#[tauri::command]
pub fn timer_presets_update(
    id: i64,
    name: String,
    duration_minutes: i64,
    is_favorite: bool,
    db: State<Database>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let fav: i64 = if is_favorite { 1 } else { 0 };
    conn.execute(
        "UPDATE timer_presets SET name = ?1, duration_minutes = ?2, is_favorite = ?3 WHERE id = ?4",
        params![name, duration_minutes, fav, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn timer_presets_delete(id: i64, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM timer_presets WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn timer_presets_toggle_favorite(id: i64, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE timer_presets SET is_favorite = 1 - is_favorite WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
