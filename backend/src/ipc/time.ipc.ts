import { ipcMain, BrowserWindow } from "electron"
import {
  startPomodoro,  pausePomodoro,  stopPomodoro,
  startStopwatch, pauseStopwatch, stopStopwatch,
  getSettings,    updateSettings,
  getFocusSessionHistory, getTodayFocusMinutes, getYesterdayFocusMinutes,
} from "../services/time.service"

let mainWindow: BrowserWindow | null = null

export function registerTimerHandlers(win: BrowserWindow) {
  mainWindow = win

  /* ── Pomodoro ── */
  ipcMain.handle("pomodoro:start",  () => startPomodoro(mainWindow!))
  ipcMain.handle("pomodoro:pause",  () => pausePomodoro())
  ipcMain.handle("pomodoro:stop",   () => stopPomodoro())

  ipcMain.handle("pomodoro:getSettings", () => getSettings())

  ipcMain.handle("pomodoro:updateSettings", (_, { workMinutes, breakMinutes }) => {
    const work = Number(workMinutes)
    const brk  = Number(breakMinutes)

    if (isNaN(work) || isNaN(brk))
      throw new Error("Timer settings must be valid numbers")
    if (work < 1 || brk < 1)
      throw new Error("Timer settings must be at least 1 minute")

    updateSettings(work, brk)
  })

  /* ── Stopwatch ── */
  ipcMain.handle("stopwatch:start", () => startStopwatch(mainWindow!))
  ipcMain.handle("stopwatch:pause", () => pauseStopwatch())
  ipcMain.handle("stopwatch:stop",  () => stopStopwatch())

  /* ── Focus session history (for Dashboard heatmap + ring) ── */
  ipcMain.handle("focus:history",        () => getFocusSessionHistory())
  ipcMain.handle("focus:todayMinutes",   () => getTodayFocusMinutes())
  ipcMain.handle("focus:yesterdayMinutes", () => getYesterdayFocusMinutes())
}