import { create } from "zustand"
import { playSuccess } from "../lib/sounds"

/** Canonical status values — must match backend VALID_STATUSES exactly. */
export type TaskStatus = "todo" | "in-progress" | "done"

/** Eisenhower matrix quadrants */
export type TaskPriority = "urgent-important" | "important" | "urgent" | "neither"

export type Task = {
  id: number
  title: string
  status: TaskStatus
  due_date?: string | null       // "YYYY-MM-DD" — shown on calendar
  completed_at?: string | null   // ISO date string, set when status → done
  created_at?: string
  parent_id?: number | null      // subtask relationship
  sort_order: number             // custom ordering
  priority?: TaskPriority | null // Eisenhower classification
  description?: string | null    // task details/notes
  archived?: boolean
}

export type DayActivity = {
  date: string   // "YYYY-MM-DD"
  count: number
}

type TasksStore = {
  tasks: Task[]
  archivedTasks: Task[]
  completionHistory: DayActivity[]
  loadTasks: () => Promise<void>
  loadArchivedTasks: () => Promise<void>
  loadCompletionHistory: () => Promise<void>
  createTask: (title: string, parentId?: number | null) => Promise<void>
  updateStatus: (id: number, status: TaskStatus) => Promise<void>
  updateDueDate: (id: number, due_date: string | null) => Promise<void>
  updatePriority: (id: number, priority: TaskPriority | null) => Promise<void>
  updateDescription: (id: number, description: string | null) => Promise<void>
  reorderTasks: (taskOrders: [number, number][]) => Promise<void>
  deleteTask: (id: number) => Promise<void>
  archiveTask: (id: number) => Promise<void>
  archiveDone: () => Promise<number>
  restoreTask: (id: number) => Promise<void>
}

export const useTasksStore = create<TasksStore>((set) => ({
  tasks: [],
  archivedTasks: [],
  completionHistory: [],

  loadTasks: async () => {
    const data = await window.electron.invoke("tasks:list") as Task[]
    set({ tasks: data })
  },

  loadCompletionHistory: async () => {
    const data = await window.electron.invoke("tasks:completionHistory") as DayActivity[]
    set({ completionHistory: data })
  },

  createTask: async (title, parentId) => {
    if (!title.trim()) return
    if (parentId != null) {
      await window.electron.invoke("tasks:create", { title, parentId })
    } else {
      await window.electron.invoke("tasks:create", title)
    }
    const data = await window.electron.invoke("tasks:list") as Task[]
    set({ tasks: data })
  },

  updateStatus: async (id, status) => {
    const snapshot = useTasksStore.getState().tasks
    try {
      await window.electron.invoke("tasks:updateStatus", { id, status })
      if (status === "done") playSuccess()
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

  updatePriority: async (id, priority) => {
    await window.electron.invoke("tasks:updatePriority", { id, priority })
    const data = await window.electron.invoke("tasks:list") as Task[]
    set({ tasks: data })
  },

  updateDescription: async (id, description) => {
    await window.electron.invoke("tasks:updateDescription", { id, description })
    const data = await window.electron.invoke("tasks:list") as Task[]
    set({ tasks: data })
  },

  reorderTasks: async (taskOrders) => {
    await window.electron.invoke("tasks:reorder", taskOrders)
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

  loadArchivedTasks: async () => {
    const data = await window.electron.invoke("tasks:listArchived") as Task[]
    set({ archivedTasks: data })
  },

  archiveTask: async (id) => {
    await window.electron.invoke("tasks:archive", id)
    const data = await window.electron.invoke("tasks:list") as Task[]
    set({ tasks: data })
  },

  archiveDone: async () => {
    const count = await window.electron.invoke("tasks:archiveDone") as number
    const data = await window.electron.invoke("tasks:list") as Task[]
    set({ tasks: data })
    return count
  },

  restoreTask: async (id) => {
    await window.electron.invoke("tasks:restore", id)
    const [tasks, archived] = await Promise.all([
      window.electron.invoke("tasks:list") as Promise<Task[]>,
      window.electron.invoke("tasks:listArchived") as Promise<Task[]>,
    ])
    set({ tasks, archivedTasks: archived })
  },
}))
