import { useEffect, useRef, useState } from "react"
import { useTasksStore } from "../store/tasks.store"
import type { TaskStatus } from "../store/tasks.store"

const STATUSES = ["todo", "in-progress", "done"] as const

const STATUS_CONFIG: Record<TaskStatus, {
  label: string; accent: string; glow: string; dot: string; bg: string
}> = {
  "todo":        { label: "To Do",       accent: "var(--text-tertiary)",  glow: "rgba(255,255,255,0.08)", dot: "#94a3b8", bg: "rgba(148,163,184,0.06)" },
  "in-progress": { label: "In Progress", accent: "var(--color-blue)",     glow: "rgba(96,165,250,0.12)",  dot: "#60a5fa", bg: "rgba(96,165,250,0.06)"  },
  "done":        { label: "Done",        accent: "var(--color-green)",    glow: "rgba(52,211,153,0.12)",  dot: "#34d399", bg: "rgba(52,211,153,0.06)"  },
}

/* ──────────────────────────────────────────
   Global styles (keyframes)
────────────────────────────────────────── */
function useGlobalStyles() {
  useEffect(() => {
    const id = "tasks-global-styles"
    if (document.getElementById(id)) return
    const s = document.createElement("style")
    s.id = id
    s.textContent = `
      @keyframes badgePop {
        0%   { transform: scale(0.7); opacity: 0.5; }
        70%  { transform: scale(1.15); }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes taskIn {
        from { opacity: 0; transform: translateY(8px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)  scale(1);    }
      }
      @keyframes colGlow {
        0%,100% { box-shadow: inset 0 0 0 2px transparent; }
        50%     { box-shadow: inset 0 0 0 2px rgba(129,140,248,0.25); }
      }
    `
    document.head.appendChild(s)
    return () => document.getElementById(id)?.remove()
  }, [])
}

/* ──────────────────────────────────────────
   useDragDrop  — pointer-event based drag & drop
   Works in Tauri WebView where HTML5 D&D is unreliable
────────────────────────────────────────── */
type DragState = {
  taskId: number
  fromStatus: TaskStatus
  startX: number
  startY: number
  currentX: number
  currentY: number
  active: boolean          // true once dragged > threshold
}

function useDragDrop(onDrop: (taskId: number, toStatus: TaskStatus) => void) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [overCol, setOverCol] = useState<TaskStatus | null>(null)
  const colRefs = useRef<Partial<Record<TaskStatus, HTMLDivElement>>>({})
  const ghostRef = useRef<HTMLDivElement | null>(null)

  /* ── Create / destroy floating ghost ── */
  useEffect(() => {
    if (!drag?.active) {
      ghostRef.current?.remove()
      ghostRef.current = null
      return
    }
    if (!ghostRef.current) {
      const g = document.createElement("div")
      g.style.cssText = `
        position:fixed; z-index:9999; pointer-events:none;
        padding:8px 12px; border-radius:10px;
        background:var(--glass-bg-hover);
        border:1.5px solid var(--accent-border);
        box-shadow:0 8px 32px rgba(0,0,0,0.4);
        font-size:12px; font-weight:500;
        color:var(--text-primary);
        max-width:220px; white-space:nowrap;
        overflow:hidden; text-overflow:ellipsis;
        transform:rotate(2deg) scale(1.04);
        transition:none; opacity:0.92;
      `
      document.body.appendChild(g)
      ghostRef.current = g
    }
    return () => { ghostRef.current?.remove(); ghostRef.current = null }
  }, [drag?.active])

  /* ── Move ghost with cursor ── */
  useEffect(() => {
    if (!drag?.active || !ghostRef.current) return
    ghostRef.current.style.left = `${drag.currentX + 14}px`
    ghostRef.current.style.top  = `${drag.currentY - 16}px`
  })

  /* ── Detect which column pointer is over ── */
  useEffect(() => {
    if (!drag?.active) { setOverCol(null); return }
    let found: TaskStatus | null = null
    for (const s of STATUSES) {
      const el = colRefs.current[s]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (drag.currentX >= r.left && drag.currentX <= r.right &&
          drag.currentY >= r.top  && drag.currentY <= r.bottom) {
        found = s; break
      }
    }
    setOverCol(found)
  }, [drag?.currentX, drag?.currentY, drag?.active])

  /* ── Global pointermove / pointerup ── */
  useEffect(() => {
    if (!drag) return

    const THRESHOLD = 5

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      const moved = Math.sqrt(dx * dx + dy * dy) > THRESHOLD
      setDrag(d => d ? { ...d, currentX: e.clientX, currentY: e.clientY, active: d.active || moved } : null)
      if (ghostRef.current && drag.active) {
        ghostRef.current.style.left = `${e.clientX + 14}px`
        ghostRef.current.style.top  = `${e.clientY - 16}px`
      }
    }

    const onUp = (e: PointerEvent) => {
      if (drag.active) {
        // find column under pointer
        let target: TaskStatus | null = null
        for (const s of STATUSES) {
          const el = colRefs.current[s]
          if (!el) continue
          const r = el.getBoundingClientRect()
          if (e.clientX >= r.left && e.clientX <= r.right &&
              e.clientY >= r.top  && e.clientY <= r.bottom) {
            target = s; break
          }
        }
        if (target && target !== drag.fromStatus) {
          onDrop(drag.taskId, target)
        }
      }
      ghostRef.current?.remove()
      ghostRef.current = null
      setDrag(null)
      setOverCol(null)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup",   onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup",   onUp)
    }
  }, [drag, onDrop])

  const startDrag = (taskId: number, fromStatus: TaskStatus, title: string, e: React.PointerEvent) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    if (ghostRef.current) ghostRef.current.textContent = title
    setDrag({
      taskId, fromStatus,
      startX: e.clientX, startY: e.clientY,
      currentX: e.clientX, currentY: e.clientY,
      active: false,
    })
  }

  const setColRef = (s: TaskStatus) => (el: HTMLDivElement | null) => {
    if (el) colRefs.current[s] = el
  }

  const isDragging    = (id: number) => drag?.taskId === id && drag.active
  const isDraggingAny = drag?.active === true

  return { startDrag, setColRef, overCol, isDragging, isDraggingAny, dragState: drag }
}

/* ──────────────────────────────────────────
   Animate card in on mount
────────────────────────────────────────── */
function useCardEnter(delay: number) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.animation = `taskIn 0.22s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms both`
  }, [delay])
  return ref
}

/* ──────────────────────────────────────────
   Tasks Page
────────────────────────────────────────── */
export default function Tasks() {
  const [title, setTitle]   = useState("")
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<"all" | TaskStatus>("all")
  const inputRef = useRef<HTMLInputElement>(null)

  useGlobalStyles()

  const { tasks, loadTasks, createTask, updateStatus, deleteTask } = useTasksStore()
  useEffect(() => { loadTasks() }, [])

  const handleDrop = (taskId: number, toStatus: TaskStatus) => {
    // Apply optimistic update immediately for instant visual feedback
    const prevTasks = useTasksStore.getState().tasks
    useTasksStore.setState(s => ({
      tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: toStatus } : t),
    }))
    // Persist; store will rollback to prevTasks on failure
    updateStatus(taskId, toStatus).catch(() => {
      useTasksStore.setState({ tasks: prevTasks })
    })
  }

  const { startDrag, setColRef, overCol, isDragging, isDraggingAny } = useDragDrop(handleDrop)

  const handleAddTask = async () => {
    if (!title.trim()) return
    setAdding(true)
    await createTask(title.trim())
    setTitle("")
    setTimeout(() => setAdding(false), 300)
    inputRef.current?.focus()
  }

  const filteredStatuses = filter === "all" ? [...STATUSES] : [filter] as TaskStatus[]

  const todoCount       = tasks.filter(t => t.status === "todo").length
  const inProgressCount = tasks.filter(t => t.status === "in-progress").length
  const doneCount       = tasks.filter(t => t.status === "done").length

  return (
    <div style={{ height: "100%", color: "var(--text-primary)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{
        padding: "18px 28px 14px", borderBottom: "1px solid var(--glass-border)",
        flexShrink: 0, display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
      }}>
        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 auto", minWidth: "180px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "10px",
            background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", color: "var(--accent)", flexShrink: 0,
          }}>◈</div>
          <div>
            <h1 style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "-0.3px", lineHeight: 1.2, margin: 0 }}>Tasks</h1>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "1px" }}>
              {tasks.length} total · {doneCount} completed
            </div>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {([
            { key: "all"          as const, label: "All",    count: tasks.length,    color: "var(--text-secondary)" },
            { key: "todo"         as const, label: "To Do",  count: todoCount,        color: STATUS_CONFIG.todo.dot  },
            { key: "in-progress"  as const, label: "Active", count: inProgressCount,  color: STATUS_CONFIG["in-progress"].dot },
            { key: "done"         as const, label: "Done",   count: doneCount,        color: STATUS_CONFIG.done.dot  },
          ]).map(({ key, label, count, color }) => {
            const active = filter === key
            return (
              <button key={key} onClick={() => setFilter(key)} style={{
                padding: "4px 10px", borderRadius: "8px", fontSize: "10px", fontWeight: 600,
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

        {/* Add task */}
        <div style={{ display: "flex", gap: "6px", flex: "0 1 380px", minWidth: "220px" }}>
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
            onFocus={e => (e.currentTarget.style.borderColor = "var(--accent-border)")}
            onBlur={e  => (e.currentTarget.style.borderColor = "var(--glass-border)")}
          />
          <button
            onClick={handleAddTask}
            disabled={!title.trim()}
            style={{
              padding: "8px 16px", borderRadius: "10px",
              background: title.trim() ? "var(--accent)" : "var(--glass-bg)",
              border: "none", color: title.trim() ? "white" : "var(--text-tertiary)",
              fontSize: "11px", fontWeight: 700,
              cursor: title.trim() ? "pointer" : "default",
              boxShadow: title.trim() ? "0 0 12px var(--accent-glow)" : "none",
              transform: adding ? "scale(0.96)" : "scale(1)",
              transition: "all 0.15s ease", whiteSpace: "nowrap",
            }}
          >
            {adding ? "…" : "+ Add"}
          </button>
        </div>
      </div>

      {/* ── Kanban Board ── */}
      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: filter === "all" ? "repeat(3, 1fr)" : "1fr",
        minHeight: 0, overflow: "hidden",
        cursor: isDraggingAny ? "grabbing" : "default",
      }}>
        {filteredStatuses.map((status, colIdx) => {
          const cfg        = STATUS_CONFIG[status]
          const colTasks   = tasks.filter(t => t.status === status)
          const isTarget   = overCol === status && isDraggingAny

          return (
            <div
              key={status}
              ref={setColRef(status)}
              style={{
                display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden",
                borderRight: colIdx < filteredStatuses.length - 1 ? "1px solid var(--glass-border)" : "none",
                background: isTarget
                  ? `linear-gradient(180deg, ${cfg.bg.replace("0.06","0.14")}, ${cfg.bg})`
                  : "transparent",
                transition: "background 0.18s ease",
                outline: isTarget ? `1.5px solid ${cfg.dot}40` : "1.5px solid transparent",
                outlineOffset: "-1.5px",
              }}
            >
              {/* Column header */}
              <div style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--glass-border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0,
                background: isTarget ? cfg.bg.replace("0.06","0.12") : cfg.bg,
                transition: "background 0.18s ease",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    width: "7px", height: "7px", borderRadius: "50%",
                    background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}`,
                    display: "inline-block",
                    transform: isTarget ? "scale(1.4)" : "scale(1)",
                    transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1)",
                  }} />
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: cfg.accent }}>
                    {cfg.label}
                  </span>
                </div>
                <span key={colTasks.length} style={{
                  fontSize: "10px", fontWeight: 700,
                  padding: "2px 8px", borderRadius: "20px",
                  background: cfg.glow, color: cfg.dot,
                  border: `1px solid ${cfg.dot}33`,
                  animation: "badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                }}>
                  {colTasks.length}
                </span>
              </div>

              {/* Task list */}
              <ul style={{
                flex: 1, overflowY: "auto", overflowX: "hidden",
                padding: "8px 10px", margin: 0,
                display: "flex", flexDirection: "column", gap: "5px",
                listStyle: "none",
              }}>
                {colTasks.length === 0 ? (
                  <EmptySlot isTarget={isTarget} dot={cfg.dot} status={status} />
                ) : (
                  colTasks.map((task, index) => (
                    <TaskCard
                      key={task.id}
                      index={index}
                      task={task}
                      cfg={cfg}
                      dragging={isDragging(task.id)}
                      onPointerDown={(e) => startDrag(task.id, status, task.title, e)}
                      onStatusChange={val => {
                        const prevTasks = useTasksStore.getState().tasks
                        useTasksStore.setState(s => ({
                          tasks: s.tasks.map(t => t.id === task.id ? { ...t, status: val } : t),
                        }))
                        updateStatus(task.id, val).catch(() => {
                          useTasksStore.setState({ tasks: prevTasks })
                        })
                      }}
                      onDelete={() => deleteTask(task.id)}
                    />
                  ))
                )}

                {/* Drop cue bar at bottom when dragging into non-empty col */}
                {isTarget && colTasks.length > 0 && (
                  <li aria-hidden style={{
                    height: "3px", borderRadius: "3px",
                    background: `linear-gradient(90deg, transparent, ${cfg.dot}, transparent)`,
                    opacity: 0.7, flexShrink: 0, margin: "2px 4px",
                    animation: "none",
                  }} />
                )}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────
   Empty slot
────────────────────────────────────────── */
function EmptySlot({ isTarget, dot, status }: { isTarget: boolean; dot: string; status: string }) {
  const msgs: Record<string, string> = {
    todo: "No tasks yet", "in-progress": "Nothing in progress", done: "Nothing done yet",
  }
  return (
    <li style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "8px",
      minHeight: "120px",
      border: isTarget ? `2px dashed ${dot}80` : "2px dashed transparent",
      borderRadius: "12px",
      background: isTarget ? `${dot}0d` : "transparent",
      color: isTarget ? dot : "var(--text-tertiary)",
      fontSize: "11px", transition: "all 0.18s ease",
    }}>
      <span style={{
        fontSize: "22px",
        opacity: isTarget ? 1 : 0.2,
        transform: isTarget ? "scale(1.15)" : "scale(1)",
        transition: "all 0.18s cubic-bezier(0.34,1.56,0.64,1)",
        display: "inline-block",
      }}>
        {isTarget ? "⊕" : "◌"}
      </span>
      {isTarget ? "Drop here" : msgs[status]}
    </li>
  )
}

/* ──────────────────────────────────────────
   Task Card
────────────────────────────────────────── */
function TaskCard({
  task, index, cfg, dragging,
  onPointerDown, onStatusChange, onDelete,
}: {
  task: { id: number; title: string; status: string }
  index: number
  cfg: typeof STATUS_CONFIG[TaskStatus]
  dragging: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onStatusChange: (v: TaskStatus) => void
  onDelete: () => void
}) {
  const [hovered, setHovered]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [btnAnim, setBtnAnim]   = useState(false)
  const ref = useCardEnter(index * 28)

  const isDone   = task.status === "done"
  const isDoing  = task.status === "in-progress"

  /* ── Delete with exit animation ── */
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (deleting) return
    setDeleting(true)
    const el = ref.current
    if (el) {
      el.style.transition = "opacity 0.18s ease, transform 0.18s ease, max-height 0.22s ease, padding 0.22s ease, margin 0.22s ease, gap 0.22s ease"
      el.style.opacity    = "0"
      el.style.transform  = "translateX(12px) scale(0.95)"
      el.style.maxHeight  = "0px"
      el.style.padding    = "0"
      el.style.overflow   = "hidden"
    }
    setTimeout(() => onDelete(), 220)
  }

  /* ── Status advance circle ── */
  const handleAdvance = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (btnAnim) return
    setBtnAnim(true)
    setTimeout(() => setBtnAnim(false), 320)
    const next = (task.status === "todo" ? "in-progress" : task.status === "in-progress" ? "done" : "todo") as TaskStatus
    onStatusChange(next)
  }

  const nextLabel = task.status === "todo" ? "Move to In Progress"
                  : task.status === "in-progress" ? "Mark as Done"
                  : "Reset to To Do"

  return (
    <li
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: dragging ? "var(--accent-dim)" : hovered ? "var(--glass-bg-hover)" : "var(--glass-bg)",
        border: `1px solid ${dragging ? "var(--accent-border)" : hovered ? "var(--glass-border-strong)" : "var(--glass-border)"}`,
        borderRadius: "10px",
        padding: deleting ? "0 10px" : "8px 10px",
        boxShadow: dragging ? "0 0 0 2px var(--accent-border)" : hovered ? "0 2px 10px rgba(0,0,0,0.14)" : "none",
        transform: dragging ? "scale(0.96)" : hovered && !deleting ? "translateY(-1px)" : "translateY(0)",
        transition: "background 0.12s, border-color 0.12s, box-shadow 0.12s, transform 0.12s, opacity 0.12s",
        display: "flex", alignItems: "center", gap: "8px",
        overflow: "hidden",
        maxHeight: deleting ? "0px" : "120px",
        userSelect: "none",
        opacity: dragging ? 0.45 : 1,
        cursor: "grab",
        touchAction: "none",
      }}
      /* Drag starts on pointer-down anywhere on the card EXCEPT buttons */
      onPointerDown={e => {
        if ((e.target as HTMLElement).closest("button")) return
        onPointerDown(e)
      }}
    >
      {/* ── Status circle ── */}
      <button
        onClick={handleAdvance}
        title={nextLabel}
        style={{
          width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0,
          background: isDone ? cfg.dot : "transparent",
          border: `2px solid ${cfg.dot}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", padding: 0, outline: "none",
          transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), background 0.15s, box-shadow 0.15s",
          transform: btnAnim ? "scale(1.35)" : "scale(1)",
          boxShadow: hovered ? `0 0 7px ${cfg.dot}70` : "none",
        }}
        onMouseEnter={e => { if (!isDone) e.currentTarget.style.background = `${cfg.dot}33` }}
        onMouseLeave={e => { if (!isDone) e.currentTarget.style.background = "transparent" }}
      >
        {isDone ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4.2 7.2L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : isDoing ? (
          /* Half-filled arc indicator */
          <svg width="8" height="8" viewBox="0 0 8 8">
            <path d="M4 0.5 A3.5 3.5 0 0 1 7.5 4 A3.5 3.5 0 0 1 4 7.5 Z" fill={cfg.dot} />
          </svg>
        ) : null}
      </button>

      {/* ── Title ── */}
      <span style={{
        flex: 1, fontSize: "12px", fontWeight: 500, lineHeight: 1.4,
        color: isDone ? "var(--text-tertiary)" : "var(--text-primary)",
        textDecoration: isDone ? "line-through" : "none",
        minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        transition: "color 0.18s, text-decoration 0.18s",
      }}>
        {task.title}
      </span>

      {/* ── Hover actions ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "3px", flexShrink: 0,
        opacity: hovered && !dragging ? 1 : 0,
        transform: hovered && !dragging ? "translateX(0)" : "translateX(5px)",
        transition: "opacity 0.12s, transform 0.12s",
        pointerEvents: hovered ? "auto" : "none",
      }}>
        {/* Drag handle icon */}
        <span style={{
          color: "var(--text-tertiary)", opacity: 0.5, fontSize: "12px",
          cursor: "grab", padding: "2px 3px", lineHeight: 1,
          display: "flex", flexDirection: "column", gap: "2px",
        }}>
          {"⠿"}
        </span>

        {/* Delete */}
        <button
          onClick={handleDelete}
          title="Delete"
          style={{
            padding: "3px", borderRadius: "5px",
            background: "none", border: "none", cursor: "pointer", outline: "none",
            color: "var(--text-tertiary)", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "color 0.12s, transform 0.12s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--color-red)"; e.currentTarget.style.transform = "scale(1.2)" }}
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
