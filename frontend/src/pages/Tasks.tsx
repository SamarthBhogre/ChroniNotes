import { useEffect, useRef, useState } from "react"
import { useTasksStore } from "../store/tasks.store"

const STATUSES = ["todo", "doing", "done"] as const

const STATUS_CONFIG = {
  todo:  { label: "To Do",       accent: "var(--text-tertiary)", glow: "rgba(255,255,255,0.08)", dot: "#94a3b8", bg: "rgba(148,163,184,0.06)", border: "rgba(148,163,184,0.12)" },
  doing: { label: "In Progress", accent: "var(--color-blue)",    glow: "rgba(96,165,250,0.12)",  dot: "#60a5fa", bg: "rgba(96,165,250,0.06)",  border: "rgba(96,165,250,0.15)" },
  done:  { label: "Done",        accent: "var(--color-green)",   glow: "rgba(52,211,153,0.12)",  dot: "#34d399", bg: "rgba(52,211,153,0.06)",  border: "rgba(52,211,153,0.15)" },
}

/* ── Animate list item in on mount ── */
function useEnterAnimation(delay: number) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.opacity = "0"
    el.style.transform = "translateY(8px)"
    const t = setTimeout(() => {
      el.style.transition = "opacity 0.22s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1)"
      el.style.opacity = "1"
      el.style.transform = "translateY(0)"
    }, delay)
    return () => clearTimeout(t)
  }, [delay])
  return ref
}

export default function Tasks() {
  const [title, setTitle] = useState("")
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<"all" | "todo" | "doing" | "done">("all")
  const inputRef = useRef<HTMLInputElement>(null)

  const { tasks, loadTasks, createTask, updateStatus, deleteTask } = useTasksStore()

  useEffect(() => { loadTasks() }, [])

  const handleAddTask = async () => {
    if (!title.trim()) return
    setAdding(true)
    await createTask(title)
    setTitle("")
    setTimeout(() => setAdding(false), 300)
    inputRef.current?.focus()
  }

  const filteredStatuses = filter === "all" ? [...STATUSES] : [filter] as ("todo" | "doing" | "done")[]

  // Stats
  const todoCount  = tasks.filter(t => t.status === "todo").length
  const doingCount = tasks.filter(t => t.status === "doing").length
  const doneCount  = tasks.filter(t => t.status === "done").length

  return (
    <div style={{ height: "100%", color: "var(--text-primary)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{
        padding: "18px 28px 14px",
        borderBottom: "1px solid var(--glass-border)",
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
      }}>
        {/* Title area */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 auto", minWidth: "200px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "10px",
            background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", color: "var(--accent)", flexShrink: 0,
          }}>◈</div>
          <div>
            <h1 style={{
              fontSize: "17px", fontWeight: 700, letterSpacing: "-0.3px", lineHeight: 1.2, margin: 0,
              color: "var(--text-primary)",
            }}>Tasks</h1>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "1px" }}>
              {tasks.length} total · {doneCount} completed
            </div>
          </div>
        </div>

        {/* Stats pills */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {([
            { key: "all" as const, label: "All", count: tasks.length, color: "var(--text-secondary)" },
            { key: "todo" as const, label: "To Do", count: todoCount, color: STATUS_CONFIG.todo.dot },
            { key: "doing" as const, label: "Active", count: doingCount, color: STATUS_CONFIG.doing.dot },
            { key: "done" as const, label: "Done", count: doneCount, color: STATUS_CONFIG.done.dot },
          ]).map(({ key, label, count, color }) => {
            const active = filter === key
            return (
              <button key={key} onClick={() => setFilter(key)} style={{
                padding: "4px 10px", borderRadius: "8px",
                fontSize: "10px", fontWeight: 600,
                background: active ? "var(--accent-dim)" : "var(--glass-bg)",
                border: `1px solid ${active ? "var(--accent-border)" : "transparent"}`,
                color: active ? "var(--accent)" : "var(--text-tertiary)",
                cursor: "pointer", transition: "all 0.15s ease",
                display: "flex", alignItems: "center", gap: "5px",
              }}>
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: color, display: "inline-block" }} />
                {label} <span style={{ opacity: 0.6 }}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Add task inline */}
        <div style={{ display: "flex", gap: "6px", flex: "0 1 380px", minWidth: "240px" }}>
          <input
            ref={inputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAddTask()}
            placeholder="Add a new task…"
            style={{
              flex: 1, padding: "8px 14px",
              background: "var(--glass-bg)", border: "1.5px solid var(--glass-border)",
              borderRadius: "10px", color: "var(--text-primary)", fontSize: "12px",
              outline: "none", transition: "border-color 0.15s",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--accent-border)" }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--glass-border)" }}
          />
          <button onClick={handleAddTask} disabled={!title.trim()} style={{
            padding: "8px 16px", borderRadius: "10px",
            background: title.trim() ? "var(--accent)" : "var(--glass-bg)",
            border: "none", color: title.trim() ? "white" : "var(--text-tertiary)",
            fontSize: "11px", fontWeight: 700,
            cursor: title.trim() ? "pointer" : "default",
            boxShadow: title.trim() ? "0 0 12px var(--accent-glow)" : "none",
            transform: adding ? "scale(0.96)" : "scale(1)",
            transition: "all 0.15s ease",
            whiteSpace: "nowrap",
          }}>
            {adding ? "…" : "+ Add"}
          </button>
        </div>
      </div>

      {/* ── Kanban Board ── */}
      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: filter === "all" ? "repeat(3, 1fr)" : "1fr",
        gap: "0", minHeight: 0, overflow: "hidden",
      }}>
        {filteredStatuses.map((status, colIdx) => {
          const cfg = STATUS_CONFIG[status]
          const statusTasks = tasks.filter(t => t.status === status)

          return (
            <div key={status} style={{
              display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden",
              borderRight: colIdx < filteredStatuses.length - 1 ? "1px solid var(--glass-border)" : "none",
            }}>
              {/* Column Header */}
              <div style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--glass-border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0,
                background: cfg.bg,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    width: "7px", height: "7px", borderRadius: "50%",
                    background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}`,
                    display: "inline-block", flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: "11px", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.6px",
                    color: cfg.accent,
                  }}>
                    {cfg.label}
                  </span>
                </div>

                <span key={statusTasks.length} style={{
                  fontSize: "10px", fontWeight: 700,
                  padding: "2px 8px", borderRadius: "20px",
                  background: cfg.glow, color: cfg.dot,
                  border: `1px solid ${cfg.dot}33`,
                  display: "inline-block",
                  animation: "badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                }}>
                  {statusTasks.length}
                </span>
              </div>

              {/* Task list */}
              <ul style={{
                flex: 1, overflowY: "auto", overflowX: "hidden",
                padding: "8px 10px", margin: 0,
                display: "flex", flexDirection: "column", gap: "4px",
                listStyle: "none",
              }}>
                {statusTasks.length === 0 ? (
                  <EmptyState status={status} />
                ) : (
                  statusTasks.map((task, index) => (
                    <TaskCard
                      key={task.id}
                      index={index}
                      task={task}
                      statusConfig={cfg}
                      onStatusChange={val => updateStatus(task.id, val as any)}
                      onDelete={() => deleteTask(task.id)}
                    />
                  ))
                )}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Empty state ── */
function EmptyState({ status }: { status: string }) {
  const messages: Record<string, string> = {
    todo: "No tasks waiting",
    doing: "Nothing in progress",
    done: "Complete some tasks!",
  }
  return (
    <li style={{
      textAlign: "center", padding: "40px 12px",
      fontSize: "11px", color: "var(--text-tertiary)",
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: "6px",
    }}>
      <span style={{ fontSize: "20px", opacity: 0.2 }}>◌</span>
      {messages[status] ?? "No tasks"}
    </li>
  )
}

/* ── Task Card ── */
function TaskCard({
  task, index, statusConfig,
  onStatusChange, onDelete,
}: {
  task: { id: number; title: string; status: string }
  index: number
  statusConfig: typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]
  onStatusChange: (v: string) => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const ref = useEnterAnimation(index * 30)

  const isDone = task.status === "done"

  const handleDelete = () => {
    setDeleting(true)
    const el = ref.current
    if (el) {
      el.style.transition = "opacity 0.2s ease, transform 0.2s ease, max-height 0.25s ease"
      el.style.opacity = "0"
      el.style.transform = "translateX(8px) scale(0.97)"
      el.style.maxHeight = "0"
      el.style.padding = "0"
      el.style.marginBottom = "0"
    }
    setTimeout(() => onDelete(), 220)
  }

  // Quick forward: click circle to advance status
  const nextStatus = () => {
    if (task.status === "todo") onStatusChange("doing")
    else if (task.status === "doing") onStatusChange("done")
    else onStatusChange("todo")
  }

  return (
    <li
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--glass-bg-hover)" : "var(--glass-bg)",
        border: `1px solid ${hovered ? "var(--glass-border-strong)" : "var(--glass-border)"}`,
        borderRadius: "10px",
        padding: "8px 10px",
        boxShadow: hovered ? "0 2px 12px rgba(0,0,0,0.15)" : "none",
        transform: hovered && !deleting ? "translateY(-1px)" : "translateY(0)",
        transition: "background 0.12s, border-color 0.12s, box-shadow 0.12s, transform 0.12s",
        cursor: "default",
        overflow: "hidden",
        maxHeight: "200px",
        display: "flex", alignItems: "center", gap: "8px",
      }}
    >
      {/* Status circle — clickable to advance */}
      <button onClick={nextStatus} title="Advance status" style={{
        width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0,
        background: isDone ? statusConfig.dot : "transparent",
        border: `2px solid ${statusConfig.dot}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "all 0.15s ease", padding: 0,
      }}
        onMouseEnter={e => { if (!isDone) e.currentTarget.style.background = `${statusConfig.dot}30` }}
        onMouseLeave={e => { if (!isDone) e.currentTarget.style.background = "transparent" }}
      >
        {isDone && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4.2 7.2L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Title */}
      <span style={{
        flex: 1, fontSize: "12px",
        color: isDone ? "var(--text-tertiary)" : "var(--text-primary)",
        lineHeight: 1.4, fontWeight: 500,
        textDecoration: isDone ? "line-through" : "none",
        minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {task.title}
      </span>

      {/* Controls — fade in on hover */}
      <div style={{
        display: "flex", alignItems: "center", gap: "2px", flexShrink: 0,
        opacity: hovered ? 1 : 0,
        transform: hovered ? "translateX(0)" : "translateX(4px)",
        transition: "opacity 0.12s, transform 0.12s",
      }}>
        <select
          value={task.status}
          onChange={e => onStatusChange(e.target.value)}
          title="Change status"
          style={{
            fontSize: "10px", fontWeight: 500,
            padding: "2px 6px", borderRadius: "6px",
            background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
            color: "var(--text-secondary)", cursor: "pointer",
          }}
        >
          {(["todo", "doing", "done"] as const).map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>

        <button onClick={handleDelete} title="Delete task" style={{
          padding: "3px", borderRadius: "4px",
          color: "var(--text-tertiary)", transition: "color 0.15s, transform 0.15s",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--color-red)"; e.currentTarget.style.transform = "scale(1.15)" }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.transform = "scale(1)" }}
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </li>
  )
}
