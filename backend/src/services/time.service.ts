import { BrowserWindow } from "electron"
import { getDb } from "../db"

/* ---------------- INTERNAL STATE ---------------- */

let timer: NodeJS.Timeout | null = null
let seconds = 0
let mode: "work" | "break" = "work"

/* ---------------- TYPES ---------------- */

type PomodoroSettingsRow = {
  work_minutes: number
  break_minutes: number
}

/* ---------------- SETTINGS ---------------- */

export function getSettings() {
  const db = getDb()

  const row = db
    .prepare(
      "SELECT work_minutes, break_minutes FROM pomodoro_settings LIMIT 1"
    )
    .get() as PomodoroSettingsRow | undefined

  return {
    workMinutes: row?.work_minutes ?? 25,
    breakMinutes: row?.break_minutes ?? 5,
  }
}

export function updateSettings(
  workMinutes: number,
  breakMinutes: number
) {
  const db = getDb()

  const work = Math.max(1, workMinutes)
  const brk = Math.max(1, breakMinutes)

  db.prepare("DELETE FROM pomodoro_settings").run()
  db.prepare(
    "INSERT INTO pomodoro_settings (work_minutes, break_minutes) VALUES (?, ?)"
  ).run(work, brk)
}

/* ---------------- TIMER LOGIC ---------------- */

export function startPomodoro(window?: BrowserWindow) {
  if (timer) return

  const settings = getSettings()

  mode = "work"
  seconds = settings.workMinutes * 60

  timer = setInterval(() => {
    seconds--

    window?.webContents.send("timer:update", {
      seconds,
      mode,
    })

    if (seconds <= 0) {
      mode = mode === "work" ? "break" : "work"
      seconds =
        (mode === "work"
          ? settings.workMinutes
          : settings.breakMinutes) * 60
    }
  }, 1000)
}

export function stopPomodoro() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
