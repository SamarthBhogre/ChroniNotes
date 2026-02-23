import { ipcMain } from "electron"
import { getDb } from "../db"

export function registerTaskHandlers() {
  const db = getDb()

  ipcMain.handle("tasks:create", (_, title: string) => {
    const result = db.prepare("INSERT INTO tasks (title) VALUES (?)").run(title)
    return { id: result.lastInsertRowid, title, status: "todo" }
  })

  ipcMain.handle("tasks:list", () => {
    return db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all()
  })

  ipcMain.handle("tasks:updateStatus", (_, { id, status }: { id: number; status: string }) => {
    if (status === "done") {
      db.prepare("UPDATE tasks SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, id)
    } else {
      db.prepare("UPDATE tasks SET status = ?, completed_at = NULL WHERE id = ?").run(status, id)
    }
  })

  ipcMain.handle("tasks:updateDueDate", (_, { id, due_date }: { id: number; due_date: string | null }) => {
    db.prepare("UPDATE tasks SET due_date = ? WHERE id = ?").run(due_date, id)
  })

  ipcMain.handle("tasks:delete", (_, id: number) => {
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id)
  })

  ipcMain.handle("tasks:completionHistory", () => {
    return db.prepare(`
      SELECT DATE(completed_at) as date, COUNT(*) as count
      FROM tasks
      WHERE status = 'done' AND completed_at IS NOT NULL
      GROUP BY DATE(completed_at)
      ORDER BY date ASC
    `).all()
  })

  /* Tasks that have due dates — used by calendar to show task dots */
  ipcMain.handle("tasks:withDueDates", () => {
    return db.prepare(`
      SELECT id, title, status, due_date
      FROM tasks
      WHERE due_date IS NOT NULL
      ORDER BY due_date ASC
    `).all()
  })
}