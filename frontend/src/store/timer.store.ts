import { create } from "zustand"

type Mode = "work" | "break" | "stopwatch" | "timer"

type TimerState = {
  mode:      Mode
  seconds:   number
  isRunning: boolean
  isPaused:  boolean
  tool:      "pomodoro" | "stopwatch" | "timer"   // ← Added "timer"

  workMinutes:   number
  breakMinutes:  number
  customMinutes: number   // ← NEW: custom timer duration

  setTool:         (tool: "pomodoro" | "stopwatch" | "timer") => void
  setCustom:       (minutes: number) => void   // ← NEW
  start:           () => Promise<void>
  pause:           () => Promise<void>
  stop:            () => Promise<void>
  loadSettings:    () => Promise<void>
  updateSettings:  (w: number, b: number) => Promise<void>
  updateFromMain:  (data: { seconds: number; mode: Mode }) => void
}

export const useTimerStore = create<TimerState>((set, get) => ({
  mode:      "work",
  seconds:   0,
  isRunning: false,
  isPaused:  false,
  tool:      "pomodoro",

  workMinutes:   25,
  breakMinutes:  5,
  customMinutes: 10,   // ← NEW: default 10 min

  setTool: (tool) => set({ tool, mode: tool === "timer" ? "timer" : tool === "stopwatch" ? "stopwatch" : "work" }),

  setCustom: (minutes) => set({ customMinutes: minutes }),   // ← NEW

  start: async () => {
    const { tool, customMinutes } = get()
    
    // For custom timer, set initial seconds before starting
    if (tool === "timer" && !get().isPaused) {
      set({ seconds: customMinutes * 60, mode: "timer" })
    }
    
    set({ isRunning: true, isPaused: false })
    
    // Only call IPC for pomodoro/stopwatch — custom timer runs client-side
    if (tool === "pomodoro" || tool === "stopwatch") {
      await window.electron.invoke(`${tool}:start`)
    } else if (tool === "timer") {
      // Start client-side countdown
      startClientTimer()
    }
  },

  pause: async () => {
    const { tool } = get()
    set({ isRunning: false, isPaused: true })
    
    if (tool === "pomodoro" || tool === "stopwatch") {
      await window.electron.invoke(`${tool}:pause`)
    } else if (tool === "timer") {
      stopClientTimer()
    }
  },

  stop: async () => {
    const { tool } = get()
    set({ isRunning: false, isPaused: false, seconds: 0, mode: "work" })
    
    if (tool === "pomodoro" || tool === "stopwatch") {
      await window.electron.invoke(`${tool}:stop`)
    } else if (tool === "timer") {
      stopClientTimer()
    }
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

/* ═══════════════════════════════════
   CLIENT-SIDE TIMER (no backend)
═══════════════════════════════════ */
let clientTimerInterval: NodeJS.Timeout | null = null

function startClientTimer() {
  if (clientTimerInterval) return
  
  clientTimerInterval = setInterval(() => {
    const state = useTimerStore.getState()
    
    if (!state.isRunning || state.tool !== "timer") {
      stopClientTimer()
      return
    }
    
    const newSeconds = Math.max(0, state.seconds - 1)
    useTimerStore.setState({ seconds: newSeconds })
    
    // Auto-stop when timer reaches 0
    if (newSeconds === 0) {
      stopClientTimer()
      useTimerStore.setState({ isRunning: false, isPaused: false })
      
      // Optional: Play notification sound or show alert
      if (typeof window !== "undefined" && "Notification" in window) {
        new Notification("Timer Complete", {
          body: "Your custom timer has finished!",
        })
      }
    }
  }, 1000)
}

function stopClientTimer() {
  if (clientTimerInterval) {
    clearInterval(clientTimerInterval)
    clientTimerInterval = null
  }
}