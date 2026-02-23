import { BrowserWindow } from "electron"
import { registerTaskHandlers } from "./tasks.ipc"
import { registerTimerHandlers } from "./time.ipc"
import { registerNotesHandlers } from "./notes.ipc"
import { registerTimerPresetsHandlers } from "./timer-presets.ipc"
import { registerCalendarHandlers } from "./calendar.ipc"
export function registerIpcHandlers(window: BrowserWindow) {
  registerTaskHandlers()
  registerTimerHandlers(window)
  registerNotesHandlers()
  registerTimerPresetsHandlers()
  registerCalendarHandlers()
}