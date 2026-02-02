"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
exports.updateSettings = updateSettings;
exports.startPomodoro = startPomodoro;
exports.stopPomodoro = stopPomodoro;
const db_1 = require("../db");
let timer = null;
let mode = "work";
let secondsLeft = 0;
/* ================= SETTINGS ================= */
function getSettings() {
    const db = (0, db_1.getDb)();
    const row = db
        .prepare("SELECT work_minutes, break_minutes FROM pomodoro_settings LIMIT 1")
        .get();
    return {
        workMinutes: row?.work_minutes ?? 25,
        breakMinutes: row?.break_minutes ?? 5,
    };
}
function updateSettings(settings) {
    const db = (0, db_1.getDb)();
    db.prepare("DELETE FROM pomodoro_settings").run();
    db.prepare("INSERT INTO pomodoro_settings (work_minutes, break_minutes) VALUES (?, ?)").run(settings.workMinutes, settings.breakMinutes);
}
/* ================= TIMER ================= */
function startPomodoro(window) {
    if (timer)
        return;
    const settings = getSettings();
    mode = "work";
    secondsLeft = settings.workMinutes * 60;
    timer = setInterval(() => {
        secondsLeft--;
        window?.webContents.send("timer:update", {
            seconds: secondsLeft,
            mode,
        });
        if (secondsLeft <= 0) {
            mode = mode === "work" ? "break" : "work";
            secondsLeft =
                (mode === "work"
                    ? settings.workMinutes
                    : settings.breakMinutes) * 60;
        }
    }, 1000);
}
function stopPomodoro() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}
