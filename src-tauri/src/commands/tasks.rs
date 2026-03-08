use crate::db::Database;
use chrono::NaiveDate;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

const VALID_STATUSES: &[&str] = &["todo", "in-progress", "done"];
const VALID_PRIORITIES: &[&str] = &["urgent-important", "important", "urgent", "neither"];

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub status: String,
    pub created_at: Option<String>,
    pub completed_at: Option<String>,
    pub due_date: Option<String>,
    pub parent_id: Option<i64>,
    pub sort_order: i64,
    pub priority: Option<String>,
    pub description: Option<String>,
    pub archived: bool,
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

/* ── Validation helpers ── */

fn validate_title(title: &str) -> Result<(), String> {
    if title.trim().is_empty() {
        return Err("Title must not be empty".to_string());
    }
    if title.len() > 500 {
        return Err("Title exceeds 500 characters".to_string());
    }
    Ok(())
}

fn validate_status(status: &str) -> Result<(), String> {
    if !VALID_STATUSES.contains(&status) {
        return Err(format!(
            "Invalid status '{}'. Allowed: {}",
            status,
            VALID_STATUSES.join(", ")
        ));
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
        .map_err(|_| {
            format!(
                "Date '{}' is not a valid calendar date (e.g. Feb 30 or month 13 are rejected)",
                date
            )
        })
}

/* ── Commands ── */

// All command logic lives in `pub(crate) fn *_inner(db: &Database, ...)`.
// The `#[tauri::command]` functions are thin wrappers so the core logic is
// fully unit-testable without Tauri's State machinery.

pub(crate) fn tasks_create_inner(title: String, parent_id: Option<i64>, db: &Database) -> Result<Task, String> {
    validate_title(&title)?;

    let conn = db.conn().lock().map_err(|e| e.to_string())?;

    // Validate parent exists if specified
    if let Some(pid) = parent_id {
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM tasks WHERE id = ?1)",
                params![pid],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if !exists {
            return Err(format!("Parent task {} not found", pid));
        }
    }

    conn.execute(
        "INSERT INTO tasks (title, parent_id) VALUES (?1, ?2)",
        params![title, parent_id],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(Task {
        id,
        title,
        status: "todo".to_string(),
        created_at: None,
        completed_at: None,
        due_date: None,
        parent_id,
        sort_order: 0,
        priority: None,
        description: None,
        archived: false,
    })
}

#[tauri::command]
pub fn tasks_create(title: String, parent_id: Option<i64>, db: State<Database>) -> Result<Task, String> {
    tasks_create_inner(title, parent_id, db.inner())
}

#[tauri::command]
pub fn tasks_list(db: State<Database>) -> Result<Vec<Task>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, status, created_at, completed_at, due_date,
                    parent_id, sort_order, priority, description,
                    COALESCE(archived, 0) as archived
             FROM tasks
             WHERE COALESCE(archived, 0) = 0
             ORDER BY sort_order ASC, created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                title: row.get(1)?,
                status: row.get(2)?,
                created_at: row.get(3)?,
                completed_at: row.get(4)?,
                due_date: row.get(5)?,
                parent_id: row.get(6)?,
                sort_order: row.get(7)?,
                priority: row.get(8)?,
                description: row.get(9)?,
                archived: row.get::<_, i64>(10)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string());
    rows
}

pub(crate) fn tasks_update_status_inner(
    id: i64,
    status: String,
    db: &Database,
) -> Result<(), String> {
    validate_status(&status)?;

    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let affected = if status == "done" {
        conn.execute(
            "UPDATE tasks SET status = ?1, completed_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![status, id],
        )
    } else {
        conn.execute(
            "UPDATE tasks SET status = ?1, completed_at = NULL WHERE id = ?2",
            params![status, id],
        )
    }
    .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err(format!("Task {} not found", id));
    }
    Ok(())
}

#[tauri::command]
pub fn tasks_update_status(id: i64, status: String, db: State<Database>) -> Result<(), String> {
    tasks_update_status_inner(id, status, db.inner())
}

pub(crate) fn tasks_update_due_date_inner(
    id: i64,
    due_date: Option<String>,
    db: &Database,
) -> Result<(), String> {
    if let Some(ref d) = due_date {
        validate_date(d)?;
    }

    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "UPDATE tasks SET due_date = ?1 WHERE id = ?2",
            params![due_date, id],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err(format!("Task {} not found", id));
    }
    Ok(())
}

#[tauri::command]
pub fn tasks_update_due_date(
    id: i64,
    due_date: Option<String>,
    db: State<Database>,
) -> Result<(), String> {
    tasks_update_due_date_inner(id, due_date, db.inner())
}

pub(crate) fn tasks_delete_inner(id: i64, db: &Database) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute("DELETE FROM tasks WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err(format!("Task {} not found", id));
    }
    Ok(())
}

#[tauri::command]
pub fn tasks_delete(id: i64, db: State<Database>) -> Result<(), String> {
    tasks_delete_inner(id, db.inner())
}

#[tauri::command]
pub fn tasks_completion_history(db: State<Database>) -> Result<Vec<DayActivity>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
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
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string());
    rows
}

#[tauri::command]
pub fn tasks_with_due_dates(db: State<Database>) -> Result<Vec<TaskWithDueDate>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
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
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string());
    rows
}

/// Update a task's priority (Eisenhower matrix quadrant).
pub(crate) fn tasks_update_priority_inner(
    id: i64,
    priority: Option<String>,
    db: &Database,
) -> Result<(), String> {
    if let Some(ref p) = priority {
        if !VALID_PRIORITIES.contains(&p.as_str()) {
            return Err(format!(
                "Invalid priority '{}'. Allowed: {}",
                p,
                VALID_PRIORITIES.join(", ")
            ));
        }
    }

    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "UPDATE tasks SET priority = ?1 WHERE id = ?2",
            params![priority, id],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err(format!("Task {} not found", id));
    }
    Ok(())
}

#[tauri::command]
pub fn tasks_update_priority(
    id: i64,
    priority: Option<String>,
    db: State<Database>,
) -> Result<(), String> {
    tasks_update_priority_inner(id, priority, db.inner())
}

/// Update a task's description.
#[tauri::command]
pub fn tasks_update_description(
    id: i64,
    description: Option<String>,
    db: State<Database>,
) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "UPDATE tasks SET description = ?1 WHERE id = ?2",
            params![description, id],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err(format!("Task {} not found", id));
    }
    Ok(())
}

/// Reorder tasks by setting sort_order for a batch of task IDs.
#[tauri::command]
pub fn tasks_reorder(
    task_orders: Vec<(i64, i64)>,
    db: State<Database>,
) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    for (id, order) in &task_orders {
        conn.execute(
            "UPDATE tasks SET sort_order = ?1 WHERE id = ?2",
            params![order, id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── Archive commands ─────────────────────────────────────────────────────────

/// Archive a single task (hide from active list but keep in DB).
pub(crate) fn tasks_archive_inner(id: i64, db: &Database) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "UPDATE tasks SET archived = 1 WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err(format!("Task {} not found", id));
    }
    Ok(())
}

#[tauri::command]
pub fn tasks_archive(id: i64, db: State<Database>) -> Result<(), String> {
    tasks_archive_inner(id, db.inner())
}

/// Archive all tasks with status 'done'.
pub(crate) fn tasks_archive_done_inner(db: &Database) -> Result<i64, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "UPDATE tasks SET archived = 1 WHERE status = 'done' AND COALESCE(archived, 0) = 0",
            [],
        )
        .map_err(|e| e.to_string())?;
    Ok(affected as i64)
}

#[tauri::command]
pub fn tasks_archive_done(db: State<Database>) -> Result<i64, String> {
    tasks_archive_done_inner(db.inner())
}

/// Restore an archived task (un-archive). Resets status to 'todo'.
pub(crate) fn tasks_restore_inner(id: i64, db: &Database) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "UPDATE tasks SET archived = 0, status = 'todo', completed_at = NULL WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err(format!("Task {} not found", id));
    }
    Ok(())
}

#[tauri::command]
pub fn tasks_restore(id: i64, db: State<Database>) -> Result<(), String> {
    tasks_restore_inner(id, db.inner())
}

/// List all archived tasks.
#[tauri::command]
pub fn tasks_list_archived(db: State<Database>) -> Result<Vec<Task>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, status, created_at, completed_at, due_date,
                    parent_id, sort_order, priority, description,
                    COALESCE(archived, 0) as archived
             FROM tasks
             WHERE COALESCE(archived, 0) = 1
             ORDER BY completed_at DESC, created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                title: row.get(1)?,
                status: row.get(2)?,
                created_at: row.get(3)?,
                completed_at: row.get(4)?,
                due_date: row.get(5)?,
                parent_id: row.get(6)?,
                sort_order: row.get(7)?,
                priority: row.get(8)?,
                description: row.get(9)?,
                archived: row.get::<_, i64>(10)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string());
    rows
}

/* ── Tests ── */

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tests::test_db;

    // ── Validation unit tests ─────────────────────────────────────────────────

    #[test]
    fn title_empty_rejected() {
        assert!(validate_title("").is_err());
        assert!(validate_title("   ").is_err());
    }

    #[test]
    fn title_valid_accepted() {
        assert!(validate_title("Buy milk").is_ok());
    }

    #[test]
    fn title_too_long_rejected() {
        assert!(validate_title(&"x".repeat(501)).is_err());
    }

    #[test]
    fn valid_statuses_accepted() {
        for s in VALID_STATUSES {
            assert!(validate_status(s).is_ok(), "should accept: {s}");
        }
    }

    #[test]
    fn invalid_status_rejected() {
        assert!(validate_status("completed").is_err());
        assert!(validate_status("").is_err());
        assert!(validate_status("DONE").is_err());
    }

    #[test]
    fn date_format_valid() {
        assert!(validate_date("2024-06-15").is_ok());
        assert!(validate_date("2024-02-29").is_ok()); // leap year
    }

    #[test]
    fn date_format_invalid() {
        assert!(validate_date("15-06-2024").is_err());
        assert!(validate_date("2024/06/15").is_err());
        assert!(validate_date("not-a-date").is_err());
    }

    /// chrono must reject impossible dates even when the pattern is correct.
    #[test]
    fn date_impossible_values_rejected() {
        assert!(validate_date("2026-99-99").is_err(), "month 99 must fail");
        assert!(validate_date("2026-13-01").is_err(), "month 13 must fail");
        assert!(validate_date("2024-02-30").is_err(), "Feb 30 must fail");
        assert!(
            validate_date("2023-02-29").is_err(),
            "Feb 29 non-leap must fail"
        );
    }

    // ── Command-level contract tests (via _inner helpers) ─────────────────────

    /// `tasks_create_inner` must reject empty titles and return the new task.
    #[test]
    fn command_create_rejects_empty_title() {
        let (_dir, db) = test_db();
        let err = tasks_create_inner("  ".to_string(), None, &db).unwrap_err();
        assert!(err.contains("empty"), "error must mention empty: {err}");
    }

    /// Create a task and list it — verifies the DB round-trip.
    #[test]
    fn tasks_create_and_list_roundtrip() {
        let (_dir, db) = test_db();
        let task = tasks_create_inner("Test task".to_string(), None, &db).unwrap();
        assert_eq!(task.title, "Test task");
        assert_eq!(task.status, "todo");
        assert!(task.id > 0);
    }

    /// Updating status to `done` on a real task must succeed.
    #[test]
    fn command_update_status_done() {
        let (_dir, db) = test_db();
        let task = tasks_create_inner("Status test".to_string(), None, &db).unwrap();
        tasks_update_status_inner(task.id, "done".to_string(), &db).unwrap();

        let conn = db.conn().lock().unwrap();
        let (status, completed): (String, Option<String>) = conn
            .query_row(
                "SELECT status, completed_at FROM tasks WHERE id = ?1",
                rusqlite::params![task.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(status, "done");
        assert!(completed.is_some(), "completed_at must be set");
    }

    /// Updating status on a non-existent task must return `Err`.
    #[test]
    fn command_update_status_missing_id_returns_err() {
        let (_dir, db) = test_db();
        let err = tasks_update_status_inner(9999, "done".to_string(), &db).unwrap_err();
        assert!(err.contains("9999"), "error must mention the id: {err}");
    }

    /// Updating status with an invalid value must return `Err` without
    /// touching the DB.
    #[test]
    fn command_update_status_invalid_status_returns_err() {
        let (_dir, db) = test_db();
        let task = tasks_create_inner("Validation test".to_string(), None, &db).unwrap();
        let err = tasks_update_status_inner(task.id, "DONE".to_string(), &db).unwrap_err();
        assert!(err.contains("DONE") || err.contains("Invalid"), "{err}");
    }

    /// Setting a valid due date on an existing task must succeed.
    #[test]
    fn command_update_due_date_valid() {
        let (_dir, db) = test_db();
        let task = tasks_create_inner("Due date test".to_string(), None, &db).unwrap();
        tasks_update_due_date_inner(task.id, Some("2025-12-31".to_string()), &db).unwrap();

        let conn = db.conn().lock().unwrap();
        let due: String = conn
            .query_row(
                "SELECT due_date FROM tasks WHERE id = ?1",
                rusqlite::params![task.id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(due, "2025-12-31");
    }

    /// Setting an impossible due date must return `Err` before hitting the DB.
    #[test]
    fn command_update_due_date_impossible_date_rejected() {
        let (_dir, db) = test_db();
        let task = tasks_create_inner("Date test".to_string(), None, &db).unwrap();
        let err =
            tasks_update_due_date_inner(task.id, Some("2025-13-99".to_string()), &db).unwrap_err();
        assert!(err.contains("2025-13-99") || err.contains("valid"), "{err}");
    }

    /// `tasks_update_due_date_inner` on a missing ID must return `Err`.
    #[test]
    fn command_update_due_date_missing_id_returns_err() {
        let (_dir, db) = test_db();
        let err = tasks_update_due_date_inner(9999, None, &db).unwrap_err();
        assert!(err.contains("9999"), "error must mention the id: {err}");
    }

    /// `tasks_delete_inner` on a real task must remove it.
    #[test]
    fn command_delete_existing_task() {
        let (_dir, db) = test_db();
        let task = tasks_create_inner("To delete".to_string(), None, &db).unwrap();
        tasks_delete_inner(task.id, &db).unwrap();

        let conn = db.conn().lock().unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tasks WHERE id = ?1",
                rusqlite::params![task.id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    /// `tasks_delete_inner` on a missing ID must return `Err`.
    #[test]
    fn tasks_delete_missing_returns_err() {
        let (_dir, db) = test_db();
        let err = tasks_delete_inner(9999, &db).unwrap_err();
        assert!(err.contains("9999"), "error must mention the id: {err}");
    }

    // ── Subtask tests ─────────────────────────────────────────────────────────

    #[test]
    fn subtask_creation_with_valid_parent() {
        let (_dir, db) = test_db();
        let parent = tasks_create_inner("Parent".to_string(), None, &db).unwrap();
        let child = tasks_create_inner("Child".to_string(), Some(parent.id), &db).unwrap();
        assert_eq!(child.parent_id, Some(parent.id));
    }

    #[test]
    fn subtask_creation_with_invalid_parent_rejected() {
        let (_dir, db) = test_db();
        let err = tasks_create_inner("Orphan".to_string(), Some(9999), &db).unwrap_err();
        assert!(err.contains("9999"), "error must mention the parent id: {err}");
    }

    // ── Priority tests ───────────────────────────────────────────────────────

    #[test]
    fn valid_priority_accepted() {
        let (_dir, db) = test_db();
        let task = tasks_create_inner("Priority test".to_string(), None, &db).unwrap();
        tasks_update_priority_inner(task.id, Some("urgent-important".to_string()), &db).unwrap();

        let conn = db.conn().lock().unwrap();
        let priority: String = conn
            .query_row(
                "SELECT priority FROM tasks WHERE id = ?1",
                params![task.id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(priority, "urgent-important");
    }

    #[test]
    fn invalid_priority_rejected() {
        let (_dir, db) = test_db();
        let task = tasks_create_inner("Priority test".to_string(), None, &db).unwrap();
        let err = tasks_update_priority_inner(task.id, Some("HIGH".to_string()), &db).unwrap_err();
        assert!(err.contains("HIGH") || err.contains("Invalid"), "{err}");
    }

    #[test]
    fn null_priority_clears_value() {
        let (_dir, db) = test_db();
        let task = tasks_create_inner("Priority test".to_string(), None, &db).unwrap();
        tasks_update_priority_inner(task.id, Some("important".to_string()), &db).unwrap();
        tasks_update_priority_inner(task.id, None, &db).unwrap();

        let conn = db.conn().lock().unwrap();
        let priority: Option<String> = conn
            .query_row(
                "SELECT priority FROM tasks WHERE id = ?1",
                params![task.id],
                |r| r.get(0),
            )
            .unwrap();
        assert!(priority.is_none());
    }

    // ── Archive tests ────────────────────────────────────────────────────────

    #[test]
    fn archive_hides_from_active_list() {
        let (_dir, db) = test_db();
        let task = tasks_create_inner("Archive me".to_string(), None, &db).unwrap();
        tasks_update_status_inner(task.id, "done".to_string(), &db).unwrap();
        tasks_archive_inner(task.id, &db).unwrap();

        // Active list should be empty
        let conn = db.conn().lock().unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tasks WHERE COALESCE(archived, 0) = 0",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);

        // Archived list should have it
        let archived_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tasks WHERE COALESCE(archived, 0) = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(archived_count, 1);
    }

    #[test]
    fn archive_missing_task_returns_err() {
        let (_dir, db) = test_db();
        let err = tasks_archive_inner(9999, &db).unwrap_err();
        assert!(err.contains("9999"));
    }

    #[test]
    fn restore_resets_to_todo() {
        let (_dir, db) = test_db();
        let task = tasks_create_inner("Restore me".to_string(), None, &db).unwrap();
        tasks_update_status_inner(task.id, "done".to_string(), &db).unwrap();
        tasks_archive_inner(task.id, &db).unwrap();
        tasks_restore_inner(task.id, &db).unwrap();

        let conn = db.conn().lock().unwrap();
        let (status, archived, completed): (String, i64, Option<String>) = conn
            .query_row(
                "SELECT status, COALESCE(archived, 0), completed_at FROM tasks WHERE id = ?1",
                params![task.id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!(status, "todo");
        assert_eq!(archived, 0);
        assert!(completed.is_none(), "completed_at must be cleared");
    }

    #[test]
    fn archive_done_bulk() {
        let (_dir, db) = test_db();
        let t1 = tasks_create_inner("Done 1".to_string(), None, &db).unwrap();
        let t2 = tasks_create_inner("Done 2".to_string(), None, &db).unwrap();
        let _t3 = tasks_create_inner("Still todo".to_string(), None, &db).unwrap();
        tasks_update_status_inner(t1.id, "done".to_string(), &db).unwrap();
        tasks_update_status_inner(t2.id, "done".to_string(), &db).unwrap();

        let count = tasks_archive_done_inner(&db).unwrap();
        assert_eq!(count, 2);

        // Only "Still todo" should remain active
        let conn = db.conn().lock().unwrap();
        let active: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tasks WHERE COALESCE(archived, 0) = 0",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(active, 1);
    }
}
