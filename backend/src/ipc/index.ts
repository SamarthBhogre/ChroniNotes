import { registerTaskHandlers } from "./tasks.ipc"
import { registerTimerHandlers } from "./time.ipc"
import { BrowserWindow } from "electron"

let registered = false

export function registerIpcHandlers(window: BrowserWindow) {
  if (registered) return
  registered = true

  registerTaskHandlers()
  registerTimerHandlers(window)
}
