"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTaskHandlers = registerTaskHandlers;
const electron_1 = require("electron");
const db_1 = require("../db");
function registerTaskHandlers() {
    const db = (0, db_1.getDb)();
    electron_1.ipcMain.handle("tasks:create", (_, title) => {
        const stmt = db.prepare("INSERT INTO tasks (title, status) VALUES (?, 'todo')");
        const result = stmt.run(title);
        return {
            id: result.lastInsertRowid,
            title,
            status: "todo",
        };
    });
    electron_1.ipcMain.handle("tasks:list", () => {
        return db
            .prepare("SELECT * FROM tasks ORDER BY id DESC")
            .all();
    });
    electron_1.ipcMain.handle("tasks:updateStatus", (_, { id, status }) => {
        db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, id);
    });
    electron_1.ipcMain.handle("tasks:delete", (_, id) => {
        db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    });
}
