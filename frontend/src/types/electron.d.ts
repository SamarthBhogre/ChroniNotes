export {}

declare global {
  interface Window {
    electron: {
      invoke: (
        channel: string,
        payload?: unknown
      ) => Promise<any>

      on: (
        channel: string,
        listener: (...args: any[]) => void
      ) => void
    }
  }
}
