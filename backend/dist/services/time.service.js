"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
exports.updateSettings = updateSettings;
exports.startPomodoro = startPomodoro;
exports.pausePomodoro = pausePomodoro;
exports.stopPomodoro = stopPomodoro;
exports.startStopwatch = startStopwatch;
exports.pauseStopwatch = pauseStopwatch;
exports.stopStopwatch = stopStopwatch;
const db_1 = require("../db");
/* ---------------- INTERNAL STATE ---------------- */
let pomodoroTimer = null;
let pomodoroSeconds = 0;
let pomodoroMode = "work";
let pomodoroPaused = false; // ← NEW
let stopwatchTimer = null;
let stopwatchSeconds = 0;
let stopwatchPaused = false; // ← NEW
/* ---------------- SETTINGS ---------------- */
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
function updateSettings(workMinutes, breakMinutes) {
    const db = (0, db_1.getDb)();
    const work = Math.max(1, Math.floor(Number(workMinutes) || 25));
    const brk = Math.max(1, Math.floor(Number(breakMinutes) || 5));
    if (isNaN(work) || isNaN(brk)) {
        console.error("Invalid settings received:", { workMinutes, breakMinutes });
        throw new Error("Timer settings must be valid numbers");
    }
    db.prepare("DELETE FROM pomodoro_settings").run();
    db.prepare("INSERT INTO pomodoro_settings (work_minutes, break_minutes) VALUES (?, ?)").run(work, brk);
}
/* ---------------- POMODORO ---------------- */
function startPomodoro(window) {
    // Resume from pause — just restart the interval, keep seconds
    if (pomodoroPaused && !pomodoroTimer) {
        pomodoroPaused = false;
        pomodoroTimer = createPomodoroInterval(window);
        return;
    }
    // Already running — do nothing
    if (pomodoroTimer)
        return;
    // Fresh start
    const settings = getSettings();
    pomodoroMode = "work";
    pomodoroSeconds = settings.workMinutes * 60;
    pomodoroPaused = false;
    pomodoroTimer = createPomodoroInterval(window);
}
function createPomodoroInterval(window) {
    const settings = getSettings();
    return setInterval(() => {
        pomodoroSeconds--;
        window?.webContents.send("timer:update", {
            seconds: pomodoroSeconds,
            mode: pomodoroMode,
        });
        if (pomodoroSeconds <= 0) {
            pomodoroMode = pomodoroMode === "work" ? "break" : "work";
            pomodoroSeconds = (pomodoroMode === "work"
                ? settings.workMinutes
                : settings.breakMinutes) * 60;
        }
    }, 1000);
}
function pausePomodoro() {
    if (pomodoroTimer) {
        clearInterval(pomodoroTimer);
        pomodoroTimer = null;
        pomodoroPaused = true; // remember we are paused, not stopped
    }
}
function stopPomodoro() {
    if (pomodoroTimer) {
        clearInterval(pomodoroTimer);
        pomodoroTimer = null;
    }
    // Full reset
    pomodoroSeconds = 0;
    pomodoroMode = "work";
    pomodoroPaused = false;
}
/* ---------------- STOPWATCH ---------------- */
function startStopwatch(window) {
    // Resume from pause — keep elapsed seconds
    if (stopwatchPaused && !stopwatchTimer) {
        stopwatchPaused = false;
        stopwatchTimer = createStopwatchInterval(window);
        return;
    }
    // Already running — do nothing
    if (stopwatchTimer)
        return;
    // Fresh start
    stopwatchSeconds = 0;
    stopwatchPaused = false;
    stopwatchTimer = createStopwatchInterval(window);
}
function createStopwatchInterval(window) {
    return setInterval(() => {
        stopwatchSeconds++;
        window?.webContents.send("timer:update", {
            seconds: stopwatchSeconds,
            mode: "stopwatch",
        });
    }, 1000);
}
function pauseStopwatch() {
    if (stopwatchTimer) {
        clearInterval(stopwatchTimer);
        stopwatchTimer = null;
        stopwatchPaused = true; // remember we are paused, not stopped
    }
}
function stopStopwatch() {
    if (stopwatchTimer) {
        clearInterval(stopwatchTimer);
        stopwatchTimer = null;
    }
    // Full reset
    stopwatchSeconds = 0;
    stopwatchPaused = false;
}
