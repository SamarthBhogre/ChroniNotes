"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTimerHandlers = registerTimerHandlers;
const electron_1 = require("electron");
const time_service_1 = require("../services/time.service");
let mainWindow = null;
function registerTimerHandlers(win) {
    mainWindow = win;
    /* ── Pomodoro ── */
    electron_1.ipcMain.handle("pomodoro:start", () => (0, time_service_1.startPomodoro)(mainWindow));
    electron_1.ipcMain.handle("pomodoro:pause", () => (0, time_service_1.pausePomodoro)()); // ← NEW
    electron_1.ipcMain.handle("pomodoro:stop", () => (0, time_service_1.stopPomodoro)());
    electron_1.ipcMain.handle("pomodoro:getSettings", () => (0, time_service_1.getSettings)());
    electron_1.ipcMain.handle("pomodoro:updateSettings", (_, { workMinutes, breakMinutes }) => {
        const work = Number(workMinutes);
        const brk = Number(breakMinutes);
        if (isNaN(work) || isNaN(brk))
            throw new Error("Timer settings must be valid numbers");
        if (work < 1 || brk < 1)
            throw new Error("Timer settings must be at least 1 minute");
        (0, time_service_1.updateSettings)(work, brk);
    });
    /* ── Stopwatch ── */
    electron_1.ipcMain.handle("stopwatch:start", () => (0, time_service_1.startStopwatch)(mainWindow));
    electron_1.ipcMain.handle("stopwatch:pause", () => (0, time_service_1.pauseStopwatch)()); // ← NEW
    electron_1.ipcMain.handle("stopwatch:stop", () => (0, time_service_1.stopStopwatch)());
}
