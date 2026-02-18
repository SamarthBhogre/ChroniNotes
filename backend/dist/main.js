"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const db_1 = require("./db");
const ipc_1 = require("./ipc");
let mainWindow;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        titleBarStyle: "hidden",
        show: false, // ← Don't show until ready
        backgroundColor: "#060811", // ← Match app bg so no white flash
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
        },
    });
    mainWindow.loadURL("http://localhost:5173");
    // Show window only after the page has fully rendered
    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });
}
electron_1.app.whenReady().then(() => {
    (0, db_1.initDatabase)();
    createWindow();
    (0, ipc_1.registerIpcHandlers)(mainWindow);
    registerWindowControls();
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
// Window control handlers
function registerWindowControls() {
    electron_1.ipcMain.handle("window-minimize", () => {
        if (mainWindow)
            mainWindow.minimize();
    });
    electron_1.ipcMain.handle("window-maximize", () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            }
            else {
                mainWindow.maximize();
            }
        }
    });
    electron_1.ipcMain.handle("window-close", () => {
        if (mainWindow)
            mainWindow.close();
    });
}
