"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electron", {
    invoke: (channel, payload) => electron_1.ipcRenderer.invoke(channel, payload),
    on: (channel, listener) => {
        electron_1.ipcRenderer.on(channel, (_event, ...args) => listener(...args));
    },
});
