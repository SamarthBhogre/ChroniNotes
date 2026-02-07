"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTimeHandlers = registerTimeHandlers;
const electron_1 = require("electron");
const time_service_1 = require("../services/time.service");
function registerTimeHandlers(window) {
    electron_1.ipcMain.handle("pomodoro:start", () => {
        (0, time_service_1.startPomodoro)(window);
    });
    electron_1.ipcMain.handle("pomodoro:stop", () => {
        (0, time_service_1.stopPomodoro)();
    });
    electron_1.ipcMain.handle("pomodoro:getSettings", () => {
        return (0, time_service_1.getSettings)();
    });
    electron_1.ipcMain.handle("pomodoro:updateSettings", (_, payload) => {
        (0, time_service_1.updateSettings)(payload.workMinutes, payload.breakMinutes);
    });
}
