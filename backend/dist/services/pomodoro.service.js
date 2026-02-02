"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPomodoro = startPomodoro;
exports.stopPomodoro = stopPomodoro;
const electron_1 = require("electron");
const db_1 = require("../db");
let timer = null;
let secondsLeft = 0;
let mode = "work";
function startPomodoro(win) {
    if (timer)
        return;
    const db = (0, db_1.getDb)();
    const settings = db
        .prepare("SELECT work_minutes, break_minutes FROM pomodoro_settings WHERE id = 1")
        .get();
    const workSeconds = settings.work_minutes * 60;
    const breakSeconds = settings.break_minutes * 60;
    mode = "work";
    secondsLeft = workSeconds;
    timer = setInterval(() => {
        secondsLeft--;
        win.webContents.send("pomodoro:tick", {
            secondsLeft,
            mode,
        });
        if (secondsLeft <= 0) {
            db.prepare(`INSERT INTO pomodoro_sessions (mode, duration_minutes)
         VALUES (?, ?)`).run(mode, mode === "work"
                ? settings.work_minutes
                : settings.break_minutes);
            new electron_1.Notification({
                title: "ChroniNotes",
                body: mode === "work"
                    ? "Break time!"
                    : "Back to work!",
            }).show();
            mode = mode === "work" ? "break" : "work";
            secondsLeft =
                mode === "work" ? workSeconds : breakSeconds;
        }
    }, 1000);
}
function stopPomodoro() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}
