import { app, BrowserWindow, ipcMain, Notification } from "electron"
import path from "path"
import { initDatabase } from "./db"
import { registerIpcHandlers } from "./ipc"

let mainWindow: BrowserWindow

// Set app user model ID for Windows notifications (shows custom app name instead of "Electron")
const APP_NAME = "ChroniNotes"
if (process.platform === "win32") {
  app.setAppUserModelId(APP_NAME)
}

/**
 * Show a startup notification when the app launches
 */
function showStartupNotification() {
  try {
    if (!Notification.isSupported()) {
      console.warn("[Startup] Notifications are not supported on this system")
      return
    }

    const notification = new Notification({
      title: "ChroniNotes",
      body: "Welcome back! Ready to boost your productivity?",
      silent: false,
      timeoutType: "default",
    })

    notification.on("click", () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore()
        }
        mainWindow.focus()
      }
      notification.close()
    })

    notification.show()

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      try {
        notification.close()
      } catch (e) {
        // Already closed
      }
    }, 4000)

    console.log("[Startup] Welcome notification displayed")
  } catch (error) {
    console.error("[Startup] Failed to show notification:", error)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: "hidden",
    show: false,                    // ← Don't show until ready
    backgroundColor: "#060811",     // ← Match app bg so no white flash
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  })

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173")
  } else {
    mainWindow.loadFile(path.join(__dirname, "../frontend/dist/index.html"))
  }

  // Show window only after the page has fully rendered
  mainWindow.once("ready-to-show", () => {
    mainWindow.show()
    
    // Show startup notification after a small delay to ensure window is visible
    setTimeout(() => {
      showStartupNotification()
    }, 500)
  })
}

app.whenReady().then(() => {
  initDatabase()
  createWindow()
  registerIpcHandlers(mainWindow)
  registerWindowControls()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

// Window control handlers
function registerWindowControls() {
  ipcMain.handle("window-minimize", () => {
    if (mainWindow) mainWindow.minimize()
  })

  ipcMain.handle("window-maximize", () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
    }
  })

  ipcMain.handle("window-close", () => {
    if (mainWindow) mainWindow.close()
  })
}
