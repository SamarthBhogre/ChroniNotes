"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const ipc_1 = require("./ipc");
const db_1 = require("./db");
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
        },
    });
    mainWindow.loadURL("http://localhost:5173");
}
electron_1.app.whenReady().then(() => {
    (0, db_1.initDatabase)();
    createWindow();
    (0, ipc_1.registerIpcHandlers)(mainWindow);
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
