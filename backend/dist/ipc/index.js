"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = registerIpcHandlers;
const tasks_ipc_1 = require("./tasks.ipc");
const time_ipc_1 = require("./time.ipc");
let registered = false;
function registerIpcHandlers(window) {
    if (registered)
        return;
    registered = true;
    (0, tasks_ipc_1.registerTaskHandlers)();
    (0, time_ipc_1.registerTimerHandlers)(window);
}
