import { ipcMain, BrowserWindow } from "electron"
import {
  startPomodoro,
  stopPomodoro,
} from "../services/pomodoro.service"

export function registerPomodoroHandlers(
  win: BrowserWindow
) {
  ipcMain.handle("pomodoro:start", () => {
    startPomodoro(win)
  })

  ipcMain.handle("pomodoro:stop", () => {
    stopPomodoro()
  })
}
