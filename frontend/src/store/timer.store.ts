import { create } from "zustand"

type Mode = "work" | "break" | "stopwatch"

type TimerState = {
  mode:      Mode
  seconds:   number
  isRunning: boolean
  isPaused:  boolean                          // ← NEW
  tool:      "pomodoro" | "stopwatch"

  workMinutes:  number
  breakMinutes: number

  setTool:        (tool: "pomodoro" | "stopwatch") => void
  start:          () => Promise<void>
  pause:          () => Promise<void>         // ← NEW
  stop:           () => Promise<void>
  loadSettings:   () => Promise<void>
  updateSettings: (w: number, b: number) => Promise<void>
  updateFromMain: (data: { seconds: number; mode: Mode }) => void
}

export const useTimerStore = create<TimerState>((set, get) => ({
  mode:      "work",
  seconds:   0,
  isRunning: false,
  isPaused:  false,                           // ← NEW
  tool:      "pomodoro",

  workMinutes:  25,
  breakMinutes: 5,

  setTool: (tool) => set({ tool }),

  start: async () => {
    const { tool } = get()
    set({ isRunning: true, isPaused: false }) // ← clear paused on start/resume
    await window.electron.invoke(`${tool}:start`)
  },

  pause: async () => {                        // ← NEW
    const { tool } = get()
    set({ isRunning: false, isPaused: true })
    await window.electron.invoke(`${tool}:pause`)
  },

  stop: async () => {
    const { tool } = get()
    set({ isRunning: false, isPaused: false, seconds: 0, mode: "work" }) // full reset
    await window.electron.invoke(`${tool}:stop`)
  },

  loadSettings: async () => {
    const s = await window.electron.invoke("pomodoro:getSettings")
    set({ workMinutes: s.workMinutes, breakMinutes: s.breakMinutes })
  },

  updateSettings: async (w, b) => {
    await window.electron.invoke("pomodoro:updateSettings", {
      workMinutes:  w,
      breakMinutes: b,
    })
    set({ workMinutes: w, breakMinutes: b })
  },

  updateFromMain: (data) =>
    set({ seconds: data.seconds, mode: data.mode }),
}))