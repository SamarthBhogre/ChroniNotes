import { BrowserWindow } from "electron"
import { getDb } from "../db"

let timer: NodeJS.Timeout | null = null
let mode: "work" | "break" = "work"
let secondsLeft = 0

/* ================= TYPES ================= */

type PomodoroSettingsRow = {
  work_minutes: number
  break_minutes: number
}

/* ================= SETTINGS ================= */

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

export function updateSettings(settings: {
  workMinutes: number
  breakMinutes: number
}) {
  const db = getDb()

  db.prepare("DELETE FROM pomodoro_settings").run()
  db.prepare(
    "INSERT INTO pomodoro_settings (work_minutes, break_minutes) VALUES (?, ?)"
  ).run(settings.workMinutes, settings.breakMinutes)
}

/* ================= TIMER ================= */

export function startPomodoro(window?: BrowserWindow) {
  if (timer) return

  const settings = getSettings()

  mode = "work"
  secondsLeft = settings.workMinutes * 60

  timer = setInterval(() => {
    secondsLeft--

    window?.webContents.send("timer:update", {
      seconds: secondsLeft,
      mode,
    })

    if (secondsLeft <= 0) {
      mode = mode === "work" ? "break" : "work"
      secondsLeft =
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
