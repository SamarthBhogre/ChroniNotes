import { app, BrowserWindow } from "electron"
import path from "path"
import { initDatabase } from "./db"
import { registerIpcHandlers } from "./ipc"

let mainWindow: BrowserWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  })

  mainWindow.loadURL("http://localhost:5173")
}

app.whenReady().then(() => {
  initDatabase()
  createWindow()
  registerIpcHandlers(mainWindow)
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
