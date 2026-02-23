import { create } from "zustand"

type TaskStatus = "todo" | "doing" | "done"

export type Task = {
  id: number
  title: string
  status: TaskStatus
  due_date?: string | null       // "YYYY-MM-DD" — shown on calendar
  completed_at?: string | null   // ISO date string, set when status → done
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
  updateDueDate: (id: number, due_date: string | null) => Promise<void>
  deleteTask: (id: number) => Promise<void>
}

export const useTasksStore = create<TasksStore>((set) => ({
  tasks: [],
  completionHistory: [],

  loadTasks: async () => {
    const data = await window.electron.invoke("tasks:list")
    set({ tasks: data })
  },

  loadCompletionHistory: async () => {
    const data = await window.electron.invoke("tasks:completionHistory")
    set({ completionHistory: data })
  },

  createTask: async (title) => {
    if (!title.trim()) return
    await window.electron.invoke("tasks:create", title)
    const data = await window.electron.invoke("tasks:list")
    set({ tasks: data })
  },

  updateStatus: async (id, status) => {
    await window.electron.invoke("tasks:updateStatus", { id, status })
    const [tasks, history] = await Promise.all([
      window.electron.invoke("tasks:list"),
      window.electron.invoke("tasks:completionHistory"),
    ])
    set({ tasks, completionHistory: history })
  },

  updateDueDate: async (id, due_date) => {
    await window.electron.invoke("tasks:updateDueDate", { id, due_date })
    const data = await window.electron.invoke("tasks:list")
    set({ tasks: data })
  },

  deleteTask: async (id) => {
    await window.electron.invoke("tasks:delete", id)
    const [tasks, history] = await Promise.all([
      window.electron.invoke("tasks:list"),
      window.electron.invoke("tasks:completionHistory"),
    ])
    set({ tasks, completionHistory: history })
  },
}))