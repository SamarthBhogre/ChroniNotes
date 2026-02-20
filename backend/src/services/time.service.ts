import { BrowserWindow } from "electron"
import { getDb } from "../db"
import {
  notifyWorkSessionStart,
  notifyBreakSessionStart,
  notifyBreakEnded,
  notifyTimerPaused,
  notifyTimerStopped,
  notifyStopwatchStart,
} from "./notification.service"

/* ---------------- INTERNAL STATE ---------------- */

let pomodoroTimer: NodeJS.Timeout | null = null
let pomodoroSeconds = 0
let pomodoroMode: "work" | "break" = "work"
let pomodoroPaused = false
let pomodoroNotified = false

let stopwatchTimer: NodeJS.Timeout | null = null
let stopwatchSeconds = 0
let stopwatchPaused = false

// Store window reference for notifications
let currentWindow: BrowserWindow | undefined = undefined

/* ---------------- TYPES ---------------- */

type PomodoroSettingsRow = {
  work_minutes: number
  break_minutes: number
}

/* ---------------- SETTINGS ---------------- */

export function getSettings() {
  const db = getDb()
  const row = db
    .prepare("SELECT work_minutes, break_minutes FROM pomodoro_settings LIMIT 1")
    .get() as PomodoroSettingsRow | undefined

  return {
    workMinutes:  row?.work_minutes  ?? 25,
    breakMinutes: row?.break_minutes ?? 5,
  }
}

export function updateSettings(workMinutes: number, breakMinutes: number) {
  const db = getDb()

  const work = Math.max(1, Math.floor(Number(workMinutes) || 25))
  const brk  = Math.max(1, Math.floor(Number(breakMinutes) || 5))

  if (isNaN(work) || isNaN(brk)) {
    console.error("Invalid settings received:", { workMinutes, breakMinutes })
    throw new Error("Timer settings must be valid numbers")
  }

  db.prepare("DELETE FROM pomodoro_settings").run()
  db.prepare(
    "INSERT INTO pomodoro_settings (work_minutes, break_minutes) VALUES (?, ?)"
  ).run(work, brk)
}

/* ---------------- POMODORO ---------------- */

export function startPomodoro(window?: BrowserWindow) {
  // Store window reference
  currentWindow = window

  // Resume from pause — just restart the interval, keep seconds
  if (pomodoroPaused && !pomodoroTimer) {
    pomodoroPaused = false
    pomodoroTimer = createPomodoroInterval()
    return
  }

  // Already running — do nothing
  if (pomodoroTimer) return

  // Fresh start
  const settings = getSettings()
  pomodoroMode    = "work"
  pomodoroSeconds = settings.workMinutes * 60
  pomodoroPaused  = false
  pomodoroNotified = false
  pomodoroTimer   = createPomodoroInterval()

  // Send notification for work session start
  notifyWorkSessionStart(currentWindow).catch(console.error)
}

function createPomodoroInterval(): NodeJS.Timeout {
  const settings = getSettings()

  return setInterval(() => {
    pomodoroSeconds--

    currentWindow?.webContents.send("timer:update", {
      seconds: pomodoroSeconds,
      mode:    pomodoroMode,
    })

    // Notify when transitioning to break or work
    if (pomodoroSeconds <= 0) {
      pomodoroMode    = pomodoroMode === "work" ? "break" : "work"
      pomodoroSeconds = (pomodoroMode === "work"
        ? settings.workMinutes
        : settings.breakMinutes) * 60

      // Send appropriate notification
      if (pomodoroMode === "break") {
        notifyBreakSessionStart(currentWindow).catch(console.error)
      } else {
        notifyBreakEnded(currentWindow).catch(console.error)
      }
      pomodoroNotified = false
    }
  }, 1000)
}

export function pausePomodoro() {
  if (pomodoroTimer) {
    clearInterval(pomodoroTimer)
    pomodoroTimer  = null
    pomodoroPaused = true
  }

  // Send pause notification
  notifyTimerPaused(currentWindow).catch(console.error)
}

export function stopPomodoro() {
  if (pomodoroTimer) {
    clearInterval(pomodoroTimer)
    pomodoroTimer = null
  }
  // Full reset
  pomodoroSeconds = 0
  pomodoroMode    = "work"
  pomodoroPaused  = false

  // Send stop notification
  notifyTimerStopped(currentWindow).catch(console.error)
}

/* ---------------- STOPWATCH ---------------- */

export function startStopwatch(window?: BrowserWindow) {
  // Store window reference
  currentWindow = window

  // Resume from pause — keep elapsed seconds
  if (stopwatchPaused && !stopwatchTimer) {
    stopwatchPaused = false
    stopwatchTimer  = createStopwatchInterval()
    return
  }

  // Already running — do nothing
  if (stopwatchTimer) return

  // Fresh start
  stopwatchSeconds = 0
  stopwatchPaused  = false
  stopwatchTimer   = createStopwatchInterval()

  // Send notification for stopwatch start
  notifyStopwatchStart(currentWindow).catch(console.error)
}

function createStopwatchInterval(): NodeJS.Timeout {
  return setInterval(() => {
    stopwatchSeconds++

    currentWindow?.webContents.send("timer:update", {
      seconds: stopwatchSeconds,
      mode:    "stopwatch" as any,
    })
  }, 1000)
}

export function pauseStopwatch() {
  if (stopwatchTimer) {
    clearInterval(stopwatchTimer)
    stopwatchTimer  = null
    stopwatchPaused = true
  }

  // Send pause notification
  notifyTimerPaused(currentWindow).catch(console.error)
}

export function stopStopwatch() {
  if (stopwatchTimer) {
    clearInterval(stopwatchTimer)
    stopwatchTimer = null
  }
  // Full reset
  stopwatchSeconds = 0
  stopwatchPaused  = false

  // Send stop notification
  notifyTimerStopped(currentWindow).catch(console.error)
}
