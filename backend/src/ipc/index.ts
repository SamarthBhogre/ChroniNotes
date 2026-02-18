import { BrowserWindow } from "electron"
import { registerTaskHandlers } from "./tasks.ipc"
import { registerTimerHandlers } from "./time.ipc"

export function registerIpcHandlers(
  window: BrowserWindow
) {
  registerTaskHandlers()
  registerTimerHandlers(window)
}
