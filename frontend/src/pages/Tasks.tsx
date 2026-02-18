import { useEffect, useRef, useState } from "react"
import { useTasksStore } from "../store/tasks.store"

const STATUSES = ["todo", "doing", "done"] as const

const STATUS_CONFIG = {
  todo:  { label: "To Do",       accent: "var(--text-tertiary)", glow: "rgba(255,255,255,0.08)", dot: "#94a3b8" },
  doing: { label: "In Progress", accent: "var(--color-blue)",    glow: "rgba(96,165,250,0.12)",  dot: "#60a5fa" },
  done:  { label: "Done",        accent: "var(--color-green)",   glow: "rgba(52,211,153,0.12)",  dot: "#34d399" },
}

/* ── Animate list item in on mount ── */
function useEnterAnimation(delay: number) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.opacity = "0"
    el.style.transform = "translateY(10px)"
    const t = setTimeout(() => {
      el.style.transition = "opacity 0.28s ease, transform 0.28s cubic-bezier(0.34,1.56,0.64,1)"
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

  const { tasks, loadTasks, createTask, updateStatus, deleteTask } = useTasksStore()

  useEffect(() => { loadTasks() }, [])

  const handleAddTask = async () => {
    if (!title.trim()) return
    setAdding(true)
    await createTask(title)
    setTitle("")
    setTimeout(() => setAdding(false), 300)
  }

  return (
    <div className="h-full" style={{ color: "var(--text-primary)" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "56px 64px 40px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: "36px" }}>
          <div
            className="inline-flex items-center gap-2 mb-4"
            style={{
              padding: "3px 10px", borderRadius: "20px",
              background: "var(--accent-dim)",
              border: "1px solid var(--accent-border)",
              fontSize: "10.5px", fontWeight: 600,
              color: "var(--accent)", letterSpacing: "0.3px",
            }}
          >
            ◈ Tasks
          </div>

          <h1 style={{
            fontSize: "2.4rem", fontWeight: 700,
            letterSpacing: "-0.5px", lineHeight: 1.15, marginBottom: "8px",
            background: "linear-gradient(135deg, var(--text-primary) 40%, var(--accent))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Tasks
          </h1>
          <p style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}>
            Organize your work across kanban-style boards
          </p>
        </div>

        {/* ── Add Task Input ── */}
        <div className="flex gap-2" style={{ marginBottom: "28px" }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAddTask()}
            placeholder="Add a new task…"
            style={{
              flex: 1, padding: "10px 16px",
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--radius-lg)",
              color: "var(--text-primary)", fontSize: "13.5px",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = "var(--accent-border)"
              e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-glow)"
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = "var(--glass-border)"
              e.currentTarget.style.boxShadow = "none"
            }}
          />
          <button
            onClick={handleAddTask}
            disabled={!title.trim()}
            style={{
              padding: "10px 22px",
              borderRadius: "var(--radius-lg)",
              background: title.trim()
                ? "linear-gradient(135deg, var(--glow-a), var(--glow-b))"
                : "var(--glass-bg)",
              border: "1px solid",
              borderColor: title.trim() ? "transparent" : "var(--glass-border)",
              color: title.trim() ? "white" : "var(--text-tertiary)",
              fontSize: "13px", fontWeight: 600,
              boxShadow: title.trim() ? "0 0 16px var(--accent-glow)" : "none",
              transform: adding ? "scale(0.96)" : "scale(1)",
              transition: "all 0.2s ease",
              cursor: title.trim() ? "pointer" : "not-allowed",
            }}
          >
            {adding ? "Adding…" : "Add Task"}
          </button>
        </div>

        {/* ── Kanban Board ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {STATUSES.map(status => {
            const cfg = STATUS_CONFIG[status]
            const statusTasks = tasks.filter(t => t.status === status)

            return (
              <div
                key={status}
                className="glass flex flex-col"
                style={{
                  borderRadius: "var(--radius-xl)", padding: "16px",
                  minHeight: "320px", position: "relative", overflow: "hidden",
                }}
              >
                {/* Column corner glow */}
                <div style={{
                  position: "absolute", top: "-30px", right: "-30px",
                  width: "100px", height: "100px", borderRadius: "50%",
                  background: cfg.dot, opacity: 0.07,
                  filter: "blur(25px)", pointerEvents: "none",
                  transition: "opacity 0.4s ease",
                }} />

                {/* Column Header */}
                <div className="flex items-center justify-between" style={{
                  marginBottom: "14px", paddingBottom: "12px",
                  borderBottom: "1px solid var(--glass-border)",
                }}>
                  <div className="flex items-center gap-2">
                    <span style={{
                      width: "7px", height: "7px", borderRadius: "50%",
                      background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}`,
                      display: "inline-block", flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: "11px", fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.8px",
                      color: cfg.accent,
                    }}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Animated count badge */}
                  <span
                    key={statusTasks.length}
                    style={{
                      fontSize: "10px", fontWeight: 700,
                      padding: "2px 8px", borderRadius: "20px",
                      background: cfg.glow, color: cfg.dot,
                      border: `1px solid ${cfg.dot}33`,
                      display: "inline-block",
                      animation: "badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                    }}
                  >
                    {statusTasks.length}
                  </span>
                </div>

                {/* Task list */}
                <ul className="flex-1" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {statusTasks.length === 0 ? (
                    <EmptyState />
                  ) : (
                    statusTasks.map((task, index) => (
                      <TaskCard
                        key={task.id}
                        index={index}
                        task={task}
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
    </div>
  )
}

/* ── Empty state ── */
function EmptyState() {
  return (
    <li style={{
      textAlign: "center", padding: "36px 0",
      fontSize: "12px", color: "var(--text-tertiary)",
      fontStyle: "italic", listStyle: "none",
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: "8px",
    }}>
      <span style={{ fontSize: "20px", opacity: 0.3 }}>◌</span>
      No tasks yet
    </li>
  )
}

/* ── Task Card ── */
function TaskCard({
  task, index,
  onStatusChange, onDelete,
}: {
  task: { id: number; title: string; status: string }
  index: number
  onStatusChange: (v: string) => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const ref = useEnterAnimation(index * 40)   // staggered entry

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

  return (
    <li
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--glass-bg-hover)" : "var(--glass-bg)",
        border: `1px solid ${hovered ? "var(--glass-border-strong)" : "var(--glass-border)"}`,
        borderRadius: "var(--radius-md)",
        padding: "10px 12px",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: hovered ? "var(--glass-shadow)" : "none",
        transform: hovered && !deleting ? "translateY(-2px)" : "translateY(0)",
        transition: "background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s cubic-bezier(0.34,1.56,0.64,1)",
        cursor: "default",
        listStyle: "none",
        overflow: "hidden",
        maxHeight: "200px",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span style={{
          flex: 1, fontSize: "12.5px",
          color: "var(--text-primary)",
          lineHeight: 1.55, fontWeight: 500,
        }}>
          {task.title}
        </span>

        {/* Controls — fade in on hover */}
        <div className="flex items-center gap-1 flex-shrink-0" style={{
          opacity: hovered ? 1 : 0,
          transform: hovered ? "translateX(0)" : "translateX(4px)",
          transition: "opacity 0.15s ease, transform 0.15s ease",
        }}>
          <select
            value={task.status}
            onChange={e => onStatusChange(e.target.value)}
            title="Change status"
            style={{
              fontSize: "10.5px", fontWeight: 500,
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--accent-border)" }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--glass-border)" }}
          >
            {(["todo", "doing", "done"] as const).map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>

          <button
            onClick={handleDelete}
            title="Delete task"
            style={{
              padding: "3px", borderRadius: "var(--radius-sm)",
              color: "var(--text-tertiary)",
              transition: "color 0.15s, transform 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = "var(--color-red)"
              e.currentTarget.style.transform = "scale(1.2)"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = "var(--text-tertiary)"
              e.currentTarget.style.transform = "scale(1)"
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </li>
  )
}