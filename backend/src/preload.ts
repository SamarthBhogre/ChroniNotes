import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("electron", {
  invoke: (channel: string, payload?: unknown) =>
    ipcRenderer.invoke(channel, payload),

  on: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => listener(...args))
  },
})
