import { app, BrowserWindow, ipcMain } from "electron"
import path from "path"
import { initDatabase } from "./db"
import { registerIpcHandlers } from "./ipc"

let mainWindow: BrowserWindow

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

  mainWindow.loadURL("http://localhost:5173")

  // Show window only after the page has fully rendered
  mainWindow.once("ready-to-show", () => {
    mainWindow.show()
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
