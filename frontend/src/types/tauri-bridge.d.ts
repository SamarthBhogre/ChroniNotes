/**
 * Type declarations for the Tauri bridge compatibility layer.
 * 
 * The bridge (lib/tauri-bridge.ts) sets up window.electron for
 * backward compatibility with stores/components that use the
 * Electron-style IPC pattern.
 */
interface Window {
  electron: {
    invoke: (channel: string, payload?: unknown) => Promise<any>
    on: (channel: string, listener: (...args: any[]) => void) => void
  }
}
