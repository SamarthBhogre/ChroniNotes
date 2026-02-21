import { ipcMain } from "electron"
import { getDb } from "../db"

export function registerTimerPresetsHandlers() {
  const db = getDb()

  // List all presets (favorites first)
  ipcMain.handle("timer-presets:list", () => {
    return db
      .prepare("SELECT * FROM timer_presets ORDER BY is_favorite DESC, created_at DESC")
      .all()
  })

  // Create new preset
  ipcMain.handle("timer-presets:create", (_, { name, duration_minutes, is_favorite }) => {
    const result = db
      .prepare(
        "INSERT INTO timer_presets (name, duration_minutes, is_favorite) VALUES (?, ?, ?)"
      )
      .run(name, duration_minutes, is_favorite ? 1 : 0)

    return {
      id: result.lastInsertRowid,
      name,
      duration_minutes,
      is_favorite: is_favorite ? 1 : 0,
    }
  })

  // Update preset
  ipcMain.handle("timer-presets:update", (_, { id, name, duration_minutes, is_favorite }) => {
    db.prepare(
      "UPDATE timer_presets SET name = ?, duration_minutes = ?, is_favorite = ? WHERE id = ?"
    ).run(name, duration_minutes, is_favorite ? 1 : 0, id)
  })

  // Delete preset
  ipcMain.handle("timer-presets:delete", (_, id) => {
    db.prepare("DELETE FROM timer_presets WHERE id = ?").run(id)
  })

  // Toggle favorite
  ipcMain.handle("timer-presets:toggle-favorite", (_, id) => {
    db.prepare(
      "UPDATE timer_presets SET is_favorite = 1 - is_favorite WHERE id = ?"
    ).run(id)
  })
}