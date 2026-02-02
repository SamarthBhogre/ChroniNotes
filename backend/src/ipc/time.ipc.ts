import { ipcMain, BrowserWindow } from "electron"
import {
  startPomodoro,
  stopPomodoro,
  getSettings,
  updateSettings,
} from "../services/time.service"

let mainWindow: BrowserWindow | null = null

export function registerTimerHandlers(window?: BrowserWindow) {
  if (window) {
    mainWindow = window
  }

  ipcMain.handle("timer:start", () => {
    if (mainWindow) {
      startPomodoro(mainWindow)
    }
  })

  ipcMain.handle("timer:stop", () => {
    stopPomodoro()
  })

  ipcMain.handle("pomodoro:getSettings", () => {
    return getSettings()
  })

  ipcMain.handle(
    "pomodoro:updateSettings",
    (_, settings: { workMinutes: number; breakMinutes: number }) => {
      updateSettings(settings)
    }
  )
}
