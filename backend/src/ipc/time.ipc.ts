import { ipcMain, BrowserWindow } from "electron"
import {
  startPomodoro,
  stopPomodoro,
  getSettings,
  updateSettings,
} from "../services/time.service"

let mainWindow: BrowserWindow | null = null

export function registerTimerHandlers(win: BrowserWindow) {
  mainWindow = win

  ipcMain.handle("pomodoro:start", () => {
    startPomodoro(mainWindow!)
  })

  ipcMain.handle("pomodoro:stop", () => {
    stopPomodoro()
  })

  ipcMain.handle("pomodoro:getSettings", () => {
    return getSettings()
  })

  ipcMain.handle(
    "pomodoro:updateSettings",
    (_, { workMinutes, breakMinutes }) => {
      updateSettings(workMinutes, breakMinutes)
    }
  )
}
