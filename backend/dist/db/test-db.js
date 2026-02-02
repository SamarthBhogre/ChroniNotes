"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testDatabase = testDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
// This file will ONLY be run temporarily for testing
function testDatabase() {
    const dbPath = path_1.default.join(electron_1.app.getPath("userData"), "chroninotes-test.db");
    console.log("SQLite DB path:", dbPath);
    const db = new better_sqlite3_1.default(dbPath);
    db.exec(`
    CREATE TABLE IF NOT EXISTS test (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT
    );
  `);
    const insert = db.prepare("INSERT INTO test (message) VALUES (?)");
    insert.run("SQLite is working!");
    const row = db.prepare("SELECT * FROM test ORDER BY id DESC LIMIT 1").get();
    console.log("Last row from DB:", row);
    db.close();
}
