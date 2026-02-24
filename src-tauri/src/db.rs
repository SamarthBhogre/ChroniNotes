use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_data_dir: &PathBuf) -> Self {
        std::fs::create_dir_all(app_data_dir).expect("Failed to create app data directory");
        let db_path = app_data_dir.join("chroninotes.db");
        let conn = Connection::open(&db_path).expect("Failed to open database");
        conn.execute_batch("
            PRAGMA journal_mode = WAL;
            PRAGMA cache_size = -2000;
            PRAGMA mmap_size = 0;
            PRAGMA temp_store = MEMORY;
            PRAGMA synchronous = NORMAL;
        ").unwrap();

        let db = Database {
            conn: Mutex::new(conn),
        };
        db.create_schema();
        db.run_migrations();
        db
    }

    fn create_schema(&self) {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'todo',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS pomodoro_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                work_minutes INTEGER NOT NULL,
                break_minutes INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS focus_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                duration_seconds INTEGER NOT NULL,
                completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timer_presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS calendar_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'event',
                date TEXT NOT NULL,
                start_time TEXT,
                end_time TEXT,
                duration_minutes INTEGER,
                color TEXT DEFAULT 'accent',
                notes TEXT,
                task_id INTEGER,
                reminder_minutes INTEGER DEFAULT NULL,
                notified INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
            );

            INSERT OR IGNORE INTO pomodoro_settings (id, work_minutes, break_minutes)
            VALUES (1, 25, 5);
            ",
        )
        .expect("Failed to create schema");
    }

    fn run_migrations(&self) {
        let conn = self.conn.lock().unwrap();

        // Check existing columns in tasks table
        let mut stmt = conn
            .prepare("PRAGMA table_info(tasks)")
            .expect("Failed to get table info");
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        if !columns.contains(&"completed_at".to_string()) {
            conn.execute_batch(
                "ALTER TABLE tasks ADD COLUMN completed_at DATETIME DEFAULT NULL;",
            )
            .expect("Migration failed: completed_at");
            log::info!("[DB] Migration: added completed_at to tasks");
        }

        if !columns.contains(&"due_date".to_string()) {
            conn.execute_batch("ALTER TABLE tasks ADD COLUMN due_date TEXT DEFAULT NULL;")
                .expect("Migration failed: due_date");
            log::info!("[DB] Migration: added due_date to tasks");
        }

        // Check existing columns in calendar_events table
        let mut stmt2 = conn
            .prepare("PRAGMA table_info(calendar_events)")
            .expect("Failed to get calendar_events table info");
        let cal_columns: Vec<String> = stmt2
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        if !cal_columns.contains(&"reminder_minutes".to_string()) {
            conn.execute_batch(
                "ALTER TABLE calendar_events ADD COLUMN reminder_minutes INTEGER DEFAULT NULL;",
            )
            .expect("Migration failed: reminder_minutes");
            log::info!("[DB] Migration: added reminder_minutes to calendar_events");
        }

        if !cal_columns.contains(&"notified".to_string()) {
            conn.execute_batch(
                "ALTER TABLE calendar_events ADD COLUMN notified INTEGER DEFAULT 0;",
            )
            .expect("Migration failed: notified");
            log::info!("[DB] Migration: added notified to calendar_events");
        }
    }
}
