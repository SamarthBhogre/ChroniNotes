"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.getDb = getDb;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
let db;
function initDatabase() {
    const dbPath = path_1.default.join(electron_1.app.getPath("userData"), "chroninotes.db");
    db = new better_sqlite3_1.default(dbPath);
    db.pragma("journal_mode = WAL");
    createSchema();
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
    type TEXT NOT NULL, -- 'pomodoro' | 'stopwatch'
    duration_seconds INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO pomodoro_settings
  (id, work_minutes, break_minutes)
  VALUES (1, 25, 5);
`);
}
function getDb() {
    if (!db) {
        throw new Error("Database not initialized");
    }
    return db;
}
