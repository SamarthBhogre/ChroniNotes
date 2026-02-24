use serde::{Deserialize, Serialize};
use rusqlite::params;
use tauri::State;
use crate::db::Database;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub status: String,
    pub created_at: Option<String>,
    pub completed_at: Option<String>,
    pub due_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DayActivity {
    pub date: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskWithDueDate {
    pub id: i64,
    pub title: String,
    pub status: String,
    pub due_date: Option<String>,
}

#[tauri::command]
pub fn tasks_create(title: String, db: State<Database>) -> Result<Task, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO tasks (title) VALUES (?1)", params![title])
        .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Task {
        id,
        title,
        status: "todo".to_string(),
        created_at: None,
        completed_at: None,
        due_date: None,
    })
}

#[tauri::command]
pub fn tasks_list(db: State<Database>) -> Result<Vec<Task>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, status, created_at, completed_at, due_date FROM tasks ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let tasks = stmt
        .query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                title: row.get(1)?,
                status: row.get(2)?,
                created_at: row.get(3)?,
                completed_at: row.get(4)?,
                due_date: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(tasks)
}

#[tauri::command]
pub fn tasks_update_status(id: i64, status: String, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    if status == "done" {
        conn.execute(
            "UPDATE tasks SET status = ?1, completed_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![status, id],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE tasks SET status = ?1, completed_at = NULL WHERE id = ?2",
            params![status, id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn tasks_update_due_date(id: i64, due_date: Option<String>, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tasks SET due_date = ?1 WHERE id = ?2",
        params![due_date, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn tasks_delete(id: i64, db: State<Database>) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn tasks_completion_history(db: State<Database>) -> Result<Vec<DayActivity>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT DATE(completed_at) as date, COUNT(*) as count
             FROM tasks
             WHERE status = 'done' AND completed_at IS NOT NULL
             GROUP BY DATE(completed_at)
             ORDER BY date ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(DayActivity {
                date: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn tasks_with_due_dates(db: State<Database>) -> Result<Vec<TaskWithDueDate>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, status, due_date
             FROM tasks
             WHERE due_date IS NOT NULL
             ORDER BY due_date ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(TaskWithDueDate {
                id: row.get(0)?,
                title: row.get(1)?,
                status: row.get(2)?,
                due_date: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}
