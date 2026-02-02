"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPomodoroHandlers = registerPomodoroHandlers;
const electron_1 = require("electron");
const pomodoro_service_1 = require("../services/pomodoro.service");
function registerPomodoroHandlers(win) {
    electron_1.ipcMain.handle("pomodoro:start", () => {
        (0, pomodoro_service_1.startPomodoro)(win);
    });
    electron_1.ipcMain.handle("pomodoro:stop", () => {
        (0, pomodoro_service_1.stopPomodoro)();
    });
}
