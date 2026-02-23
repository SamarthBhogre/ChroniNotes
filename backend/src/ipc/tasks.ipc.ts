import { ipcMain } from "electron"
import { getDb } from "../db"

export function registerTaskHandlers() {
  const db = getDb()

  ipcMain.handle("tasks:create", (_, title: string) => {
    const stmt = db.prepare(
      "INSERT INTO tasks (title) VALUES (?)"
    )
    const result = stmt.run(title)

    return {
      id: result.lastInsertRowid,
      title,
      status: "todo",
    }
  })

  ipcMain.handle("tasks:list", () => {
    return db
      .prepare("SELECT * FROM tasks ORDER BY created_at DESC")
      .all()
  })

  ipcMain.handle(
    "tasks:updateStatus",
    (_, { id, status }: { id: number; status: string }) => {
      if (status === "done") {
        // Set completed_at to current timestamp when marking done
        db.prepare(
          "UPDATE tasks SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).run(status, id)
      } else {
        // Clear completed_at if moved back to todo or doing
        db.prepare(
          "UPDATE tasks SET status = ?, completed_at = NULL WHERE id = ?"
        ).run(status, id)
      }
    }
  )

  ipcMain.handle("tasks:delete", (_, id: number) => {
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id)
  })

  /* ── New: fetch completed tasks grouped by date for heatmap ── */
  ipcMain.handle("tasks:completionHistory", () => {
    return db.prepare(`
      SELECT
        DATE(completed_at) as date,
        COUNT(*) as count
      FROM tasks
      WHERE status = 'done'
        AND completed_at IS NOT NULL
      GROUP BY DATE(completed_at)
      ORDER BY date ASC
    `).all()
  })
}