import { ipcMain } from "electron"
import { getDb } from "../db"

export function registerCalendarHandlers() {
  const db = getDb()

  /* ── Create event ── */
  ipcMain.handle("calendar:create", (_, event: {
    title: string
    type: "event" | "reminder" | "focus" | "task"
    date: string
    start_time?: string | null
    end_time?: string | null
    duration_minutes?: number | null
    color?: string | null
    notes?: string | null
    task_id?: number | null
  }) => {
    const result = db.prepare(`
      INSERT INTO calendar_events
        (title, type, date, start_time, end_time, duration_minutes, color, notes, task_id)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.title,
      event.type ?? "event",
      event.date,
      event.start_time ?? null,
      event.end_time ?? null,
      event.duration_minutes ?? null,
      event.color ?? "accent",
      event.notes ?? null,
      event.task_id ?? null,
    )
    return db.prepare("SELECT * FROM calendar_events WHERE id = ?").get(result.lastInsertRowid)
  })

  /* ── List all events (optionally filtered by month YYYY-MM) ── */
  ipcMain.handle("calendar:list", (_, month?: string) => {
    if (month) {
      return db.prepare(`
        SELECT * FROM calendar_events
        WHERE date LIKE ?
        ORDER BY date ASC, start_time ASC
      `).all(`${month}%`)
    }
    return db.prepare("SELECT * FROM calendar_events ORDER BY date ASC, start_time ASC").all()
  })

  /* ── List events for a specific date ── */
  ipcMain.handle("calendar:listByDate", (_, date: string) => {
    return db.prepare(`
      SELECT * FROM calendar_events
      WHERE date = ?
      ORDER BY start_time ASC
    `).all(date)
  })

  /* ── List events in a date range ── */
  ipcMain.handle("calendar:listByRange", (_, { from, to }: { from: string; to: string }) => {
    return db.prepare(`
      SELECT * FROM calendar_events
      WHERE date >= ? AND date <= ?
      ORDER BY date ASC, start_time ASC
    `).all(from, to)
  })

  /* ── Update event ── */
  ipcMain.handle("calendar:update", (_, { id, ...fields }: {
    id: number
    title?: string
    type?: string
    date?: string
    start_time?: string | null
    end_time?: string | null
    duration_minutes?: number | null
    color?: string | null
    notes?: string | null
    task_id?: number | null
  }) => {
    const allowed = ["title", "type", "date", "start_time", "end_time", "duration_minutes", "color", "notes", "task_id"]
    const keys    = Object.keys(fields).filter(k => allowed.includes(k))
    if (keys.length === 0) return

    const setClauses = keys.map(k => `${k} = ?`).join(", ")
    const values     = keys.map(k => (fields as any)[k])

    db.prepare(`UPDATE calendar_events SET ${setClauses} WHERE id = ?`).run(...values, id)
    return db.prepare("SELECT * FROM calendar_events WHERE id = ?").get(id)
  })

  /* ── Delete event ── */
  ipcMain.handle("calendar:delete", (_, id: number) => {
    db.prepare("DELETE FROM calendar_events WHERE id = ?").run(id)
  })

  /* ── Get dates that have events (for dot indicators on mini calendar) ── */
  ipcMain.handle("calendar:activeDates", (_, month: string) => {
    return db.prepare(`
      SELECT DISTINCT date, type
      FROM calendar_events
      WHERE date LIKE ?
      ORDER BY date ASC
    `).all(`${month}%`)
  })
}