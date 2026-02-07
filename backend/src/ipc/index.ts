import { BrowserWindow } from "electron"
import { registerTaskHandlers } from "./tasks.ipc"
import { registerTimeHandlers } from "./time.ipc"

export function registerIpcHandlers(
  window: BrowserWindow
) {
  registerTaskHandlers()
  registerTimeHandlers(window)
}
