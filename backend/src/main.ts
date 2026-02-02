import { app, BrowserWindow } from "electron"
import path from "path"
import { registerIpcHandlers } from "./ipc"
import { initDatabase } from "./db"

let mainWindow: BrowserWindow | null = null

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
  registerIpcHandlers(mainWindow!)
})


app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
