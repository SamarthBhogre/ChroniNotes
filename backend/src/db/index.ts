import Database from "better-sqlite3"
import path from "path"
import { app } from "electron"

let db: Database.Database

export function initDatabase() {
  const dbPath = path.join(
    app.getPath("userData"),
    "chroninotes.db"
  )

  db = new Database(dbPath)
  db.pragma("journal_mode = WAL")

  createSchema()
}

function createSchema() {
  db.exec(`
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

    INSERT OR IGNORE INTO pomodoro_settings
    (id, work_minutes, break_minutes)
    VALUES (1, 25, 5);
  `)
}

export function getDb() {
  if (!db) {
    throw new Error("Database not initialized")
  }
  return db
}