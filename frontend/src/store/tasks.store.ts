import { create } from "zustand"

type TaskStatus = "todo" | "doing" | "done"

export type Task = {
  id: number
  title: string
  status: TaskStatus
  completed_at?: string | null   // ISO date string, set by backend when status → done
  created_at?: string
}

export type DayActivity = {
  date: string   // "YYYY-MM-DD"
  count: number
}

type TasksStore = {
  tasks: Task[]
  completionHistory: DayActivity[]
  loadTasks: () => Promise<void>
  loadCompletionHistory: () => Promise<void>
  createTask: (title: string) => Promise<void>
  updateStatus: (id: number, status: TaskStatus) => Promise<void>
  deleteTask: (id: number) => Promise<void>
}

export const useTasksStore = create<TasksStore>((set) => ({
  tasks: [],
  completionHistory: [],

  loadTasks: async () => {
    const data = await window.electron.invoke("tasks:list")
    set({ tasks: data })
    console.log("[ZUSTAND] loadTasks executed")
  },

  loadCompletionHistory: async () => {
    const data = await window.electron.invoke("tasks:completionHistory")
    set({ completionHistory: data })
    console.log("[ZUSTAND] loadCompletionHistory executed")
  },

  createTask: async (title) => {
    if (!title.trim()) return
    await window.electron.invoke("tasks:create", title)
    const data = await window.electron.invoke("tasks:list")
    set({ tasks: data })
    console.log("[ZUSTAND] createTask executed")
  },

  updateStatus: async (id, status) => {
    await window.electron.invoke("tasks:updateStatus", { id, status })
    const [tasks, history] = await Promise.all([
      window.electron.invoke("tasks:list"),
      window.electron.invoke("tasks:completionHistory"),
    ])
    set({ tasks, completionHistory: history })
    console.log("[ZUSTAND] updateStatus executed")
  },

  deleteTask: async (id) => {
    await window.electron.invoke("tasks:delete", id)
    const [tasks, history] = await Promise.all([
      window.electron.invoke("tasks:list"),
      window.electron.invoke("tasks:completionHistory"),
    ])
    set({ tasks, completionHistory: history })
    console.log("[ZUSTAND] deleteTask executed")
  },
}))