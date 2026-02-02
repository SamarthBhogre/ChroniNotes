"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTimerHandlers = registerTimerHandlers;
const electron_1 = require("electron");
const time_service_1 = require("../services/time.service");
let mainWindow = null;
function registerTimerHandlers(window) {
    if (window) {
        mainWindow = window;
    }
    electron_1.ipcMain.handle("timer:start", () => {
        if (mainWindow) {
            (0, time_service_1.startPomodoro)(mainWindow);
        }
    });
    electron_1.ipcMain.handle("timer:stop", () => {
        (0, time_service_1.stopPomodoro)();
    });
    electron_1.ipcMain.handle("pomodoro:getSettings", () => {
        return (0, time_service_1.getSettings)();
    });
    electron_1.ipcMain.handle("pomodoro:updateSettings", (_, settings) => {
        (0, time_service_1.updateSettings)(settings);
    });
}
