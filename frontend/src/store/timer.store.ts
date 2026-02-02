import { create } from "zustand"

type Mode = "work" | "break" | "stopwatch"

type TimerState = {
  mode: Mode
  seconds: number
  isRunning: boolean
  tool: "pomodoro" | "stopwatch"

  workMinutes: number
  breakMinutes: number

  setTool: (tool: "pomodoro" | "stopwatch") => void

  start: () => Promise<void>
  stop: () => Promise<void>

  loadSettings: () => Promise<void>
  updateSettings: (w: number, b: number) => Promise<void>

  updateFromMain: (data: { seconds: number; mode: Mode }) => void
}

export const useTimerStore = create<TimerState>((set, get) => ({
  mode: "work",
  seconds: 0,
  isRunning: false,
  tool: "pomodoro",

  workMinutes: 25,
  breakMinutes: 5,

  setTool: (tool) => set({ tool }),

  start: async () => {
    const { tool } = get()
    set({ isRunning: true })
    await window.electron.invoke(`${tool}:start`)
  },

  stop: async () => {
    const { tool } = get()
    set({ isRunning: false })
    await window.electron.invoke(`${tool}:stop`)
  },

  loadSettings: async () => {
    const s = await window.electron.invoke("pomodoro:getSettings")
    set({
      workMinutes: s.work_minutes,
      breakMinutes: s.break_minutes,
    })
  },

  updateSettings: async (w, b) => {
    await window.electron.invoke("pomodoro:updateSettings", {
      work: w,
      break: b,
    })
    set({ workMinutes: w, breakMinutes: b })
  },

  updateFromMain: (data) =>
    set({
      seconds: data.seconds,
      mode: data.mode,
    }),
}))
