import { create } from "zustand"

/** Canonical status values — must match backend VALID_STATUSES exactly. */
export type TaskStatus = "todo" | "in-progress" | "done"

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
    const data = await window.electron.invoke("tasks:list") as Task[]
    set({ tasks: data })
  },

  loadCompletionHistory: async () => {
    const data = await window.electron.invoke("tasks:completionHistory") as DayActivity[]
    set({ completionHistory: data })
  },

  createTask: async (title) => {
    if (!title.trim()) return
    await window.electron.invoke("tasks:create", title)
    const data = await window.electron.invoke("tasks:list") as Task[]
    set({ tasks: data })
  },

  updateStatus: async (id, status) => {
    // Snapshot before optimistic update so we can roll back on failure
    const snapshot = useTasksStore.getState().tasks
    try {
      await window.electron.invoke("tasks:updateStatus", { id, status })
      const [tasks, history] = await Promise.all([
        window.electron.invoke("tasks:list") as Promise<Task[]>,
        window.electron.invoke("tasks:completionHistory") as Promise<DayActivity[]>,
      ])
      set({ tasks, completionHistory: history })
    } catch (err) {
      console.error("updateStatus failed — rolling back:", err)
      // Restore the snapshot so the UI reflects the true persisted state
      set({ tasks: snapshot })
    }
  },

  updateDueDate: async (id, due_date) => {
    await window.electron.invoke("tasks:updateDueDate", { id, due_date })
    const data = await window.electron.invoke("tasks:list") as Task[]
    set({ tasks: data })
  },

  deleteTask: async (id) => {
    await window.electron.invoke("tasks:delete", id)
    const [tasks, history] = await Promise.all([
      window.electron.invoke("tasks:list") as Promise<Task[]>,
      window.electron.invoke("tasks:completionHistory") as Promise<DayActivity[]>,
    ])
    set({ tasks, completionHistory: history })
  },
}))