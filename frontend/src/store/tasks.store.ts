import { create } from "zustand"

type TaskStatus = "todo" | "doing" | "done"

export type Task = {
  id: number
  title: string
  status: TaskStatus
}

type TasksStore = {
  tasks: Task[]
  loadTasks: () => Promise<void>
  createTask: (title: string) => Promise<void>
  updateStatus: (id: number, status: TaskStatus) => Promise<void>
  deleteTask: (id: number) => Promise<void>
}

export const useTasksStore = create<TasksStore>((set) => ({
  tasks: [],

  loadTasks: async () => {
    const data = await window.electron.invoke("tasks:list")
    set({ tasks: data })
    console.log("[ZUSTAND] loadTasks executed")
  },

  createTask: async (title) => {
    if (!title.trim()) return
    await window.electron.invoke("tasks:create", title)
    const data = await window.electron.invoke("tasks:list")
    set({ tasks: data })
    console.log("[ZUSTAND] createTask executed")
  },

  updateStatus: async (id, status) => {
    await window.electron.invoke("tasks:updateStatus", {
      id,
      status,
    })
    const data = await window.electron.invoke("tasks:list")
    set({ tasks: data })
    console.log("[ZUSTAND] updateStatus executed")
  },

  deleteTask: async (id) => {
    await window.electron.invoke("tasks:delete", id) // ✅ Fixed: send id directly, not { id }
    const data = await window.electron.invoke("tasks:list")
    set({ tasks: data })
    console.log("[ZUSTAND] deleteTask executed")
  },
}))