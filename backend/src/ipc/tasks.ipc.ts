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
      db.prepare(
        "UPDATE tasks SET status = ? WHERE id = ?"
      ).run(status, id)
    }
  )

  ipcMain.handle("tasks:delete", (_, id: number) => {
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id)
  })
}
