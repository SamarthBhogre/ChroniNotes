import { BrowserWindow, Notification } from "electron"
import { getDb } from "../db"

let timer: NodeJS.Timeout | null = null
let secondsLeft = 0
let mode: "work" | "break" = "work"
type PomodoroSettingsRow = {
  work_minutes: number
  break_minutes: number
}

export function startPomodoro(win: BrowserWindow) {
  if (timer) return

  const db = getDb()
  const settings = db
  .prepare("SELECT work_minutes, break_minutes FROM pomodoro_settings WHERE id = 1")
  .get() as PomodoroSettingsRow


  const workSeconds = settings.work_minutes * 60
  const breakSeconds = settings.break_minutes * 60

  mode = "work"
  secondsLeft = workSeconds

  timer = setInterval(() => {
    secondsLeft--

    win.webContents.send("pomodoro:tick", {
      secondsLeft,
      mode,
    })

    if (secondsLeft <= 0) {
      db.prepare(
        `INSERT INTO pomodoro_sessions (mode, duration_minutes)
         VALUES (?, ?)`
      ).run(
        mode,
        mode === "work"
          ? settings.work_minutes
          : settings.break_minutes
      )

      new Notification({
        title: "ChroniNotes",
        body:
          mode === "work"
            ? "Break time!"
            : "Back to work!",
      }).show()

      mode = mode === "work" ? "break" : "work"
      secondsLeft =
        mode === "work" ? workSeconds : breakSeconds
    }
  }, 1000)
}

export function stopPomodoro() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
