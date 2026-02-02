import { useEffect, useState } from "react"
import { useTasksStore } from "../store/tasks.store"

const STATUSES = ["todo", "doing", "done"] as const

export default function Tasks() {
  const [title, setTitle] = useState("")

  const {
    tasks,
    loadTasks,
    createTask,
    updateStatus,
    deleteTask,
  } = useTasksStore()

  useEffect(() => {
    loadTasks()
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Tasks</h1>

      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task..."
          className="flex-1 px-4 py-2 bg-zinc-800 rounded outline-none"
        />
        <button
          onClick={() => {
            if (!title.trim()) return
            createTask(title)
            setTitle("")
          }}
          className="px-4 py-2 bg-indigo-600 rounded"
        >
          Add
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {STATUSES.map((status) => (
          <div key={status}>
            <h2 className="font-semibold capitalize mb-2">
              {status}
            </h2>

            <ul className="space-y-2">
              {tasks
                .filter((t) => t.status === status)
                .map((task) => (
                  <li
                    key={task.id}
                    className="bg-zinc-800 p-3 rounded flex justify-between"
                  >
                    <span>{task.title}</span>

                    <div className="flex gap-2">
                      <select
                        value={task.status}
                        onChange={(e) =>
                          updateStatus(
                            task.id,
                            e.target.value as any
                          )
                        }
                        className="bg-zinc-700 rounded px-2"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
