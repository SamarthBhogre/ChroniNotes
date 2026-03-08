import { create } from "zustand"
import { playHabitCheck } from "../lib/sounds"

export type HabitFrequency = "daily" | "weekly"
export type GoalType = "at_least" | "at_most"

export type Habit = {
  id: number
  name: string
  icon: string
  color: string
  frequency: HabitFrequency
  target_count: number
  archived: boolean
  created_at?: string
  section?: string | null
  start_date?: string | null
  reminder_time?: string | null
  goal_type: GoalType
  sort_order: number
  notes?: string | null
}

export type HabitLog = {
  id: number
  habit_id: number
  date: string
  count: number
}

export type HabitStreak = {
  habit_id: number
  current_streak: number
  best_streak: number
  total_completions: number
  completion_rate: number
}

type CreateHabitParams = {
  name: string
  icon?: string
  color?: string
  frequency?: HabitFrequency
  target_count?: number
  section?: string
  start_date?: string
  reminder_time?: string
  goal_type?: GoalType
  notes?: string
}

type UpdateHabitParams = {
  name?: string
  icon?: string
  color?: string
  target_count?: number
  frequency?: HabitFrequency
  section?: string
  start_date?: string
  reminder_time?: string
  goal_type?: GoalType
  sort_order?: number
  notes?: string
}

type HabitsStore = {
  habits: Habit[]
  archivedHabits: Habit[]
  logs: HabitLog[]            // logs for the visible date range
  streaks: Record<number, HabitStreak>  // habit_id -> streak data
  loading: boolean
  error: string | null

  loadHabits: () => Promise<void>
  loadArchivedHabits: () => Promise<void>
  loadLogs: (startDate: string, endDate: string) => Promise<void>
  loadStreak: (habitId: number) => Promise<void>
  loadAllStreaks: () => Promise<void>
  createHabit: (params: CreateHabitParams) => Promise<void>
  updateHabit: (id: number, updates: UpdateHabitParams) => Promise<void>
  archiveHabit: (id: number) => Promise<void>
  restoreHabit: (id: number) => Promise<void>
  deleteHabit: (id: number) => Promise<void>
  logHabit: (habitId: number, date: string) => Promise<void>
  unlogHabit: (habitId: number, date: string) => Promise<void>
  clearError: () => void
}

export const useHabitsStore = create<HabitsStore>((set, get) => ({
  habits: [],
  archivedHabits: [],
  logs: [],
  streaks: {},
  loading: false,
  error: null,

  loadHabits: async () => {
    try {
      const data = await window.electron.invoke("habits:list") as Habit[]
      // Normalize goal_type for old records
      const normalized = data.map(h => ({
        ...h,
        goal_type: (h.goal_type || "at_least") as GoalType,
        sort_order: h.sort_order ?? 0,
      }))
      set({ habits: normalized })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  loadArchivedHabits: async () => {
    try {
      const data = await window.electron.invoke("habits:listArchived") as Habit[]
      set({ archivedHabits: data.map(h => ({ ...h, goal_type: (h.goal_type || "at_least") as GoalType })) })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  loadLogs: async (startDate, endDate) => {
    try {
      const data = await window.electron.invoke("habits:allLogs", { start_date: startDate, end_date: endDate }) as HabitLog[]
      set({ logs: data })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  loadStreak: async (habitId) => {
    try {
      const streak = await window.electron.invoke("habits:streak", { habit_id: habitId }) as HabitStreak
      set(s => ({ streaks: { ...s.streaks, [habitId]: streak } }))
    } catch (e) {
      console.warn("[Habits] Failed to load streak:", e)
    }
  },

  loadAllStreaks: async () => {
    const { habits } = get()
    const results: Record<number, HabitStreak> = {}
    await Promise.all(
      habits.map(async h => {
        try {
          const streak = await window.electron.invoke("habits:streak", { habit_id: h.id }) as HabitStreak
          results[h.id] = streak
        } catch (_) { /* ignore individual failures */ }
      })
    )
    set({ streaks: results })
  },

  createHabit: async (params) => {
    try {
      set({ loading: true, error: null })
      await window.electron.invoke("habits:create", params)
      await get().loadHabits()
      set({ loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  updateHabit: async (id, updates) => {
    try {
      await window.electron.invoke("habits:update", { id, ...updates })
      await get().loadHabits()
    } catch (e) {
      set({ error: String(e) })
    }
  },

  archiveHabit: async (id) => {
    try {
      await window.electron.invoke("habits:archive", id)
      await get().loadHabits()
    } catch (e) {
      set({ error: String(e) })
    }
  },

  restoreHabit: async (id) => {
    try {
      await window.electron.invoke("habits:restore", id)
      await get().loadHabits()
      await get().loadArchivedHabits()
    } catch (e) {
      set({ error: String(e) })
    }
  },

  deleteHabit: async (id) => {
    try {
      await window.electron.invoke("habits:delete", id)
      await get().loadHabits()
      await get().loadArchivedHabits()
      // Remove streak data
      set(s => {
        const newStreaks = { ...s.streaks }
        delete newStreaks[id]
        return { streaks: newStreaks }
      })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  logHabit: async (habitId, date) => {
    try {
      await window.electron.invoke("habits:log", { habit_id: habitId, date })
      playHabitCheck()
      // Reload logs for current range
      const { logs } = get()
      if (logs.length > 0) {
        const dates = logs.map(l => l.date).sort()
        const start = dates[0] < date ? dates[0] : date
        const end = dates[dates.length - 1] > date ? dates[dates.length - 1] : date
        await get().loadLogs(start, end)
      } else {
        await get().loadLogs(date, date)
      }
      // Refresh streak for this habit
      await get().loadStreak(habitId)
    } catch (e) {
      set({ error: String(e) })
    }
  },

  unlogHabit: async (habitId, date) => {
    try {
      await window.electron.invoke("habits:unlog", { habit_id: habitId, date })
      const { logs } = get()
      if (logs.length > 0) {
        const dates = logs.map(l => l.date).sort()
        const start = dates[0] < date ? dates[0] : date
        const end = dates[dates.length - 1] > date ? dates[dates.length - 1] : date
        await get().loadLogs(start, end)
      }
      await get().loadStreak(habitId)
    } catch (e) {
      set({ error: String(e) })
    }
  },

  clearError: () => set({ error: null }),
}))
