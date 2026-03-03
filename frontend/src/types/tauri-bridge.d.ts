/**
 * Type declarations for the Tauri bridge compatibility layer.
 *
 * The bridge (lib/tauri-bridge.ts) sets up window.electron for
 * backward compatibility with stores/components that use the
 * Electron-style IPC pattern.
 *
 * `.on()` now returns a cleanup function so useEffect hooks can
 * unsubscribe and avoid duplicate listeners under React StrictMode.
 */
interface Window {
  electron: {
    invoke: (channel: string, payload?: unknown) => Promise<unknown>
    /** Subscribe to a backend event. Returns a cleanup/unlisten function. */
    on: (channel: string, listener: (data: unknown) => void) => () => void
  }
}
