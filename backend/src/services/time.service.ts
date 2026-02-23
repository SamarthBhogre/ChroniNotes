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

// Track how many seconds have elapsed in the current work segment
let workSecondsElapsed = 0

let stopwatchTimer: NodeJS.Timeout | null = null
let stopwatchSeconds = 0
let stopwatchPaused = false

let currentWindow: BrowserWindow | undefined = undefined

/* ---------------- TYPES ---------------- */

type PomodoroSettingsRow = {
  work_minutes: number
  break_minutes: number
}

/* ---------------- HELPERS ---------------- */

function saveFocusSession(type: "work" | "break" | "stopwatch", durationSeconds: number) {
  if (durationSeconds < 10) return // ignore accidental micro-sessions
  try {
    const db = getDb()
    db.prepare(
      "INSERT INTO focus_sessions (type, duration_seconds, completed_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
    ).run(type, Math.floor(durationSeconds))
    console.log(`[DB] Saved focus session: ${type} ${durationSeconds}s`)
  } catch (e) {
    console.error("[DB] Failed to save focus session:", e)
  }
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

/* ---------------- SESSION HISTORY ---------------- */

export function getFocusSessionHistory() {
  const db = getDb()
  // Return grouped daily totals for work sessions (for heatmap)
  return db.prepare(`
    SELECT
      DATE(completed_at) as date,
      COUNT(*)           as count,
      SUM(duration_seconds) as total_seconds
    FROM focus_sessions
    WHERE type = 'work'
      AND completed_at IS NOT NULL
    GROUP BY DATE(completed_at)
    ORDER BY date ASC
  `).all()
}

export function getTodayFocusMinutes() {
  const db = getDb()
  const row = db.prepare(`
    SELECT COALESCE(SUM(duration_seconds), 0) as total
    FROM focus_sessions
    WHERE type = 'work'
      AND DATE(completed_at) = DATE('now')
  `).get() as { total: number }
  return Math.floor((row?.total ?? 0) / 60)
}

export function getYesterdayFocusMinutes() {
  const db = getDb()
  const row = db.prepare(`
    SELECT COALESCE(SUM(duration_seconds), 0) as total
    FROM focus_sessions
    WHERE type = 'work'
      AND DATE(completed_at) = DATE('now', '-1 day')
  `).get() as { total: number }
  return Math.floor((row?.total ?? 0) / 60)
}

/* ---------------- POMODORO ---------------- */

export function startPomodoro(window?: BrowserWindow) {
  currentWindow = window

  // Resume from pause
  if (pomodoroPaused && !pomodoroTimer) {
    pomodoroPaused = false
    pomodoroTimer = createPomodoroInterval()
    return
  }

  // Already running
  if (pomodoroTimer) return

  // Fresh start
  const settings = getSettings()
  pomodoroMode         = "work"
  pomodoroSeconds      = settings.workMinutes * 60
  workSecondsElapsed   = 0
  pomodoroPaused       = false
  pomodoroNotified     = false
  pomodoroTimer        = createPomodoroInterval()

  notifyWorkSessionStart(currentWindow).catch(console.error)
}

function createPomodoroInterval(): NodeJS.Timeout {
  const settings = getSettings()

  return setInterval(() => {
    pomodoroSeconds--

    // Track elapsed work time
    if (pomodoroMode === "work") {
      workSecondsElapsed++
    }

    currentWindow?.webContents.send("timer:update", {
      seconds: pomodoroSeconds,
      mode:    pomodoroMode,
    })

    if (pomodoroSeconds <= 0) {
      // Session completed naturally — save it
      if (pomodoroMode === "work") {
        saveFocusSession("work", workSecondsElapsed)
        workSecondsElapsed = 0
      }

      // Flip mode
      pomodoroMode    = pomodoroMode === "work" ? "break" : "work"
      pomodoroSeconds = (pomodoroMode === "work"
        ? settings.workMinutes
        : settings.breakMinutes) * 60

      if (pomodoroMode === "break") {
        notifyBreakSessionStart(currentWindow).catch(console.error)
      } else {
        notifyBreakEnded(currentWindow).catch(console.error)
        workSecondsElapsed = 0
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
  notifyTimerPaused(currentWindow).catch(console.error)
}

export function stopPomodoro() {
  if (pomodoroTimer) {
    clearInterval(pomodoroTimer)
    pomodoroTimer = null
  }

  // Save partial work session if meaningful time elapsed
  if (pomodoroMode === "work" && workSecondsElapsed >= 10) {
    saveFocusSession("work", workSecondsElapsed)
  }

  // Full reset
  pomodoroSeconds      = 0
  pomodoroMode         = "work"
  pomodoroPaused       = false
  workSecondsElapsed   = 0

  notifyTimerStopped(currentWindow).catch(console.error)
}

/* ---------------- STOPWATCH ---------------- */

export function startStopwatch(window?: BrowserWindow) {
  currentWindow = window

  if (stopwatchPaused && !stopwatchTimer) {
    stopwatchPaused = false
    stopwatchTimer  = createStopwatchInterval()
    return
  }

  if (stopwatchTimer) return

  stopwatchSeconds = 0
  stopwatchPaused  = false
  stopwatchTimer   = createStopwatchInterval()

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
  notifyTimerPaused(currentWindow).catch(console.error)
}

export function stopStopwatch() {
  if (stopwatchTimer) {
    // Save stopwatch session
    if (stopwatchSeconds >= 10) {
      saveFocusSession("stopwatch", stopwatchSeconds)
    }
    clearInterval(stopwatchTimer)
    stopwatchTimer = null
  }
  stopwatchSeconds = 0
  stopwatchPaused  = false
  notifyTimerStopped(currentWindow).catch(console.error)
}