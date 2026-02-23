import { useEffect, useState, useRef } from "react"
import { useCalendarStore } from "../store/calendar.store"
import type { CalendarEvent, EventType } from "../store/calendar.store"
import { useTasksStore } from "../store/tasks.store"

/* ── Colour map for event types ── */
const TYPE_COLORS: Record<EventType | string, { bg: string; border: string; text: string; dot: string }> = {
  event:    { bg: "rgba(99,102,241,0.15)",  border: "rgba(99,102,241,0.4)",  text: "#818cf8", dot: "#6366f1" },
  reminder: { bg: "rgba(251,191,36,0.15)",  border: "rgba(251,191,36,0.4)",  text: "#fbbf24", dot: "#f59e0b" },
  focus:    { bg: "rgba(52,211,153,0.15)",  border: "rgba(52,211,153,0.4)",  text: "#34d399", dot: "#10b981" },
  task:     { bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.4)", text: "#a78bfa", dot: "#8b5cf6" },
}

const TYPE_ICONS: Record<string, string> = {
  event: "◈", reminder: "◎", focus: "⊹", task: "◉",
}

/* ── Helpers ── */
function toDateStr(d: Date) {
  return d.toISOString().split("T")[0]
}
function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function startDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay() // 0=Sun
}
function formatTime(t?: string | null) {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  const ampm = h >= 12 ? "pm" : "am"
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${ampm}`
}
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

/* ══════════════════════════════════════
   EVENT CREATION / EDIT MODAL
══════════════════════════════════════ */
function EventModal({
  date, event, onSave, onDelete, onClose,
}: {
  date: string
  event?: CalendarEvent | null
  onSave: (data: Omit<CalendarEvent, "id" | "created_at">) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [title, setTitle]       = useState(event?.title ?? "")
  const [type, setType]         = useState<EventType>(event?.type ?? "event")
  const [startTime, setStart]   = useState(event?.start_time ?? "")
  const [endTime, setEnd]       = useState(event?.end_time ?? "")
  const [notes, setNotes]       = useState(event?.notes ?? "")
  const [duration, setDuration] = useState(event?.duration_minutes?.toString() ?? "25")
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 80) }, [])

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(), type, date,
      start_time: startTime || null,
      end_time: endTime || null,
      duration_minutes: type === "focus" ? parseInt(duration) || 25 : null,
      notes: notes || null,
      color: "accent", task_id: null,
    })
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3000,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "pageEnter 0.15s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(480px, calc(100vw - 40px))",
        borderRadius: "var(--radius-xl)",
        background: "var(--modal-bg, rgba(12,15,30,0.97))",
        border: "1px solid var(--glass-border-strong)",
        backdropFilter: "blur(32px)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
        animation: "settingsEnter 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px 14px",
          borderBottom: "1px solid var(--glass-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--accent)", marginBottom: "2px" }}>
              {event ? "Edit" : "New"} · {date}
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
              {event ? "Edit Event" : "Create Event"}
            </div>
          </div>
          <button onClick={onClose} style={{ width: "30px", height: "30px", borderRadius: "7px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", cursor: "pointer" }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Type selector */}
          <div style={{ display: "flex", gap: "6px" }}>
            {(["event","reminder","focus","task"] as EventType[]).map(t => {
              const c = TYPE_COLORS[t]
              const active = type === t
              return (
                <button key={t} onClick={() => setType(t)} style={{
                  flex: 1, padding: "7px 4px", borderRadius: "var(--radius-md)",
                  fontSize: "11px", fontWeight: 600, cursor: "pointer",
                  background: active ? c.bg : "var(--glass-bg)",
                  border: `1px solid ${active ? c.border : "var(--glass-border)"}`,
                  color: active ? c.text : "var(--text-tertiary)",
                  transition: "all 0.15s ease",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                }}>
                  <span style={{ fontSize: "14px" }}>{TYPE_ICONS[t]}</span>
                  <span style={{ textTransform: "capitalize" }}>{t}</span>
                </button>
              )
            })}
          </div>

          {/* Title */}
          <input
            ref={titleRef}
            value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSave() }}
            placeholder={`${type.charAt(0).toUpperCase() + type.slice(1)} title…`}
            style={{
              width: "100%", padding: "10px 12px",
              background: "var(--glass-bg)", border: "1px solid var(--glass-border-strong)",
              borderRadius: "var(--radius-md)", color: "var(--text-primary)",
              fontSize: "14px", fontWeight: 500,
              outline: "none", boxSizing: "border-box",
            }}
            onFocus={e => { e.target.style.borderColor = "var(--accent-border)" }}
            onBlur={e => { e.target.style.borderColor = "var(--glass-border-strong)" }}
          />

          {/* Time row */}
          {type !== "focus" && (
            <div style={{ display: "flex", gap: "10px" }}>
              {[{ label: "Start", val: startTime, set: setStart }, { label: "End", val: endTime, set: setEnd }].map(({ label, val, set }) => (
                <div key={label} style={{ flex: 1 }}>
                  <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "5px", letterSpacing: "0.4px", textTransform: "uppercase" }}>{label}</div>
                  <input type="time" value={val} onChange={e => set(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", background: "var(--glass-bg)", border: "1px solid var(--glass-border-strong)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
          )}

          {/* Duration for focus */}
          {type === "focus" && (
            <div>
              <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "5px", letterSpacing: "0.4px", textTransform: "uppercase" }}>Duration (minutes)</div>
              <div style={{ display: "flex", gap: "6px" }}>
                {[25, 50, 90].map(d => (
                  <button key={d} onClick={() => setDuration(String(d))} style={{
                    padding: "6px 14px", borderRadius: "var(--radius-md)", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                    background: duration === String(d) ? TYPE_COLORS.focus.bg : "var(--glass-bg)",
                    border: `1px solid ${duration === String(d) ? TYPE_COLORS.focus.border : "var(--glass-border)"}`,
                    color: duration === String(d) ? TYPE_COLORS.focus.text : "var(--text-tertiary)",
                  }}>{d}m</button>
                ))}
                <input type="number" value={duration} onChange={e => setDuration(e.target.value)} min={1}
                  style={{ flex: 1, padding: "6px 10px", background: "var(--glass-bg)", border: "1px solid var(--glass-border-strong)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "12px", outline: "none" }} />
              </div>
            </div>
          )}

          {/* Notes */}
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)…" rows={2}
            style={{ width: "100%", padding: "8px 12px", background: "var(--glass-bg)", border: "1px solid var(--glass-border-strong)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "13px", resize: "none", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
            onFocus={e => { e.target.style.borderColor = "var(--accent-border)" }}
            onBlur={e => { e.target.style.borderColor = "var(--glass-border-strong)" }}
          />

          {/* Actions */}
          <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
            {event && onDelete && (
              <button onClick={onDelete} style={{ padding: "9px 14px", borderRadius: "var(--radius-md)", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                Delete
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: "var(--radius-md)", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={!title.trim()} style={{
              padding: "9px 20px", borderRadius: "var(--radius-md)",
              background: title.trim() ? "var(--accent)" : "var(--glass-bg)",
              border: "none", color: title.trim() ? "white" : "var(--text-tertiary)",
              fontSize: "12px", fontWeight: 700, cursor: title.trim() ? "pointer" : "default",
              transition: "all 0.15s ease",
            }}>
              {event ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════
   MONTH VIEW
══════════════════════════════════════ */
function MonthView({ year, month, events, activeDates: _activeDates, selectedDate, tasksWithDates, onSelectDate, onEventClick }: {
  year: number; month: number; events: CalendarEvent[]; activeDates: any[]
  selectedDate: string; tasksWithDates: any[]
  onSelectDate: (d: string) => void; onEventClick: (e: CalendarEvent) => void
}) {
  const today      = toDateStr(new Date())
  const totalDays  = daysInMonth(year, month)
  const startDay   = startDayOfMonth(year, month)
  const totalCells = Math.ceil((startDay + totalDays) / 7) * 7

  const eventsByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})

  const tasksByDate = tasksWithDates.reduce<Record<string, any[]>>((acc, t) => {
    if (!t.due_date) return acc
    if (!acc[t.due_date]) acc[t.due_date] = []
    acc[t.due_date].push(t)
    return acc
  }, {})

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--glass-border)" }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{ padding: "8px 0", textAlign: "center", fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--text-tertiary)" }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: `repeat(${totalCells / 7}, 1fr)`, minHeight: 0 }}>
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum   = idx - startDay + 1
          const isValid  = dayNum >= 1 && dayNum <= totalDays
          const dateStr  = isValid ? `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}` : ""
          const isToday  = dateStr === today
          const isSel    = dateStr === selectedDate
          const dayEvts  = isValid ? (eventsByDate[dateStr] ?? []) : []
          const dayTasks = isValid ? (tasksByDate[dateStr] ?? []) : []

          return (
            <div key={idx} onClick={() => isValid && onSelectDate(dateStr)}
              style={{
                padding: "6px 5px", borderRight: "1px solid var(--glass-border)", borderBottom: "1px solid var(--glass-border)",
                cursor: isValid ? "pointer" : "default", minHeight: "80px",
                background: isSel ? "var(--accent-dim)" : isValid ? "transparent" : "rgba(0,0,0,0.03)",
                transition: "background 0.15s ease",
                display: "flex", flexDirection: "column", gap: "2px",
              }}
              onMouseEnter={e => { if (isValid && !isSel) e.currentTarget.style.background = "var(--glass-bg-hover)" }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isValid ? "transparent" : "rgba(0,0,0,0.03)" }}
            >
              {isValid && (
                <>
                  {/* Day number */}
                  <div style={{
                    width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", fontWeight: isToday ? 700 : 400,
                    background: isToday ? "var(--accent)" : "transparent",
                    color: isToday ? "white" : isSel ? "var(--accent)" : "var(--text-primary)",
                    boxShadow: isToday ? "0 0 8px var(--accent-glow)" : "none",
                  }}>{dayNum}</div>

                  {/* Events (max 2 visible + overflow) */}
                  {dayEvts.slice(0, 2).map(ev => {
                    const c = TYPE_COLORS[ev.type]
                    return (
                      <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                        style={{ padding: "1px 5px", borderRadius: "3px", fontSize: "10px", fontWeight: 600, background: c.bg, border: `1px solid ${c.border}`, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" }}>
                        {TYPE_ICONS[ev.type]} {ev.title}
                      </div>
                    )
                  })}

                  {/* Task dots */}
                  {dayTasks.length > 0 && (
                    <div style={{ display: "flex", gap: "2px", flexWrap: "wrap", marginTop: "1px" }}>
                      {dayTasks.slice(0, 3).map((t: any) => (
                        <div key={t.id} style={{ width: "5px", height: "5px", borderRadius: "50%", background: t.status === "done" ? "var(--color-green)" : t.status === "doing" ? "var(--color-yellow)" : "var(--text-tertiary)" }} />
                      ))}
                    </div>
                  )}

                  {/* Overflow */}
                  {dayEvts.length > 2 && (
                    <div style={{ fontSize: "9px", color: "var(--text-tertiary)", fontWeight: 600 }}>+{dayEvts.length - 2} more</div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════
   WEEK VIEW
══════════════════════════════════════ */
function WeekView({ anchorDate, events, tasksWithDates: _tasksWithDates, onSelectDate, onEventClick }: {
  anchorDate: Date; events: CalendarEvent[]; tasksWithDates: any[]
  onSelectDate: (d: string) => void; onEventClick: (e: CalendarEvent) => void
}) {
  const today   = toDateStr(new Date())
  const monday  = new Date(anchorDate)
  const dow     = monday.getDay()
  monday.setDate(monday.getDate() - dow) // start from Sunday

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    return { date: toDateStr(d), day: d.getDate(), name: DAYS_SHORT[d.getDay()] }
  })

  const evByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--glass-border)" }}>
        {weekDays.map(({ date, day, name }) => {
          const isT = date === today
          return (
            <div key={date} onClick={() => onSelectDate(date)} style={{ padding: "10px 6px", textAlign: "center", cursor: "pointer", borderRight: "1px solid var(--glass-border)" }}>
              <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "4px" }}>{name}</div>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", fontSize: "14px", fontWeight: isT ? 700 : 500, background: isT ? "var(--accent)" : "transparent", color: isT ? "white" : "var(--text-primary)", boxShadow: isT ? "0 0 8px var(--accent-glow)" : "none" }}>{day}</div>
            </div>
          )
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", flex: 1 }}>
        {weekDays.map(({ date }) => (
          <div key={date} onClick={() => onSelectDate(date)} style={{ padding: "8px 4px", borderRight: "1px solid var(--glass-border)", minHeight: "200px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "3px" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}
          >
            {(evByDate[date] ?? []).map(ev => {
              const c = TYPE_COLORS[ev.type]
              return (
                <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                  style={{ padding: "4px 6px", borderRadius: "5px", fontSize: "11px", fontWeight: 600, background: c.bg, border: `1px solid ${c.border}`, color: c.text, cursor: "pointer" }}>
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                  {ev.start_time && <div style={{ fontSize: "9px", opacity: 0.75, marginTop: "1px" }}>{formatTime(ev.start_time)}</div>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════
   DAY VIEW
══════════════════════════════════════ */
function DayView({ date, events, tasksWithDates, onEventClick }: {
  date: string; events: CalendarEvent[]; tasksWithDates: any[]; onEventClick: (e: CalendarEvent) => void
}) {
  const dayEvts  = events.filter(e => e.date === date).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))
  const dayTasks = tasksWithDates.filter(t => t.due_date === date)

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
      {dayEvts.length === 0 && dayTasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-tertiary)", fontSize: "13px" }}>
          <div style={{ fontSize: "32px", marginBottom: "10px" }}>◌</div>
          No events for this day
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {dayEvts.map(ev => {
            const c = TYPE_COLORS[ev.type]
            return (
              <div key={ev.id} onClick={() => onEventClick(ev)}
                style={{ padding: "12px 16px", borderRadius: "var(--radius-lg)", background: c.bg, border: `1px solid ${c.border}`, cursor: "pointer", transition: "all 0.15s ease" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateX(4px)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateX(0)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "14px" }}>{TYPE_ICONS[ev.type]}</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: c.text }}>{ev.title}</span>
                  {ev.start_time && <span style={{ fontSize: "11px", color: "var(--text-tertiary)", marginLeft: "auto" }}>{formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}</span>}
                </div>
                {ev.notes && <div style={{ fontSize: "12px", color: "var(--text-secondary)", paddingLeft: "22px" }}>{ev.notes}</div>}
              </div>
            )
          })}
          {dayTasks.map((t: any) => (
            <div key={`task-${t.id}`} style={{ padding: "10px 14px", borderRadius: "var(--radius-lg)", background: TYPE_COLORS.task.bg, border: `1px solid ${TYPE_COLORS.task.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: t.status === "done" ? "var(--color-green)" : t.status === "doing" ? "var(--color-yellow)" : "var(--text-tertiary)", flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: TYPE_COLORS.task.text, fontWeight: 600 }}>{t.title}</span>
              <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>{t.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════
   AGENDA VIEW
══════════════════════════════════════ */
function AgendaView({ events, tasksWithDates, onEventClick }: {
  events: CalendarEvent[]; tasksWithDates: any[]; onEventClick: (e: CalendarEvent) => void
}) {
  const today = toDateStr(new Date())

  // Group all events + tasks by date
  const allDates = new Set([
    ...events.map(e => e.date),
    ...tasksWithDates.filter(t => t.due_date).map(t => t.due_date),
  ])
  const sortedDates = Array.from(allDates).filter(d => d >= today).sort()

  if (sortedDates.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "12px", color: "var(--text-tertiary)" }}>
        <div style={{ fontSize: "36px" }}>◌</div>
        <div style={{ fontSize: "13px" }}>No upcoming events</div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
      {sortedDates.map(date => {
        const d       = new Date(date + "T12:00:00")
        const dayEvts = events.filter(e => e.date === date)
        const dayTasks = tasksWithDates.filter(t => t.due_date === date)
        const isToday = date === today

        return (
          <div key={date} style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: isToday ? "var(--accent)" : "var(--text-secondary)" }}>
                {isToday ? "Today — " : ""}{MONTHS[d.getMonth()]} {d.getDate()}, {d.getFullYear()}
              </div>
              <div style={{ flex: 1, height: "1px", background: "var(--glass-border)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {dayEvts.map(ev => {
                const c = TYPE_COLORS[ev.type]
                return (
                  <div key={ev.id} onClick={() => onEventClick(ev)}
                    style={{ padding: "10px 14px", borderRadius: "var(--radius-lg)", background: c.bg, border: `1px solid ${c.border}`, display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", transition: "all 0.15s ease" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateX(4px)" }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateX(0)" }}>
                    <span style={{ fontSize: "13px" }}>{TYPE_ICONS[ev.type]}</span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: c.text }}>{ev.title}</span>
                    {ev.start_time && <span style={{ fontSize: "11px", color: "var(--text-tertiary)", marginLeft: "auto" }}>{formatTime(ev.start_time)}</span>}
                  </div>
                )
              })}
              {dayTasks.map((t: any) => (
                <div key={`t${t.id}`} style={{ padding: "8px 14px", borderRadius: "var(--radius-lg)", background: TYPE_COLORS.task.bg, border: `1px solid ${TYPE_COLORS.task.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: t.status === "done" ? "var(--color-green)" : "var(--text-tertiary)", flexShrink: 0 }} />
                  <span style={{ fontSize: "12px", color: TYPE_COLORS.task.text, fontWeight: 600 }}>{t.title}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════
   MAIN CALENDAR PAGE
══════════════════════════════════════ */
export default function Calendar() {
  const {
    view, setView,
    currentDate, selectedDate,
    setSelectedDate, goToPrev, goToNext, goToToday,
    events, activeDates,
    loadEvents, loadActiveDates,
    createEvent, updateEvent, deleteEvent,
  } = useCalendarStore()

  const { tasks } = useTasksStore()
  const tasksWithDates = tasks.filter(t => t.due_date)

  const [modal, setModal] = useState<{ date: string; event?: CalendarEvent | null } | null>(null)

  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const mk    = monthKey(currentDate)

  useEffect(() => {
    loadEvents(mk)
    loadActiveDates(mk)
  }, [mk])

  const handleSelectDate = (date: string) => {
    setSelectedDate(date)
    setModal({ date })
  }

  const handleEventClick = (event: CalendarEvent) => {
    setModal({ date: event.date, event })
  }

  const handleSave = async (data: Omit<CalendarEvent, "id" | "created_at">) => {
    if (modal?.event) {
      await updateEvent(modal.event.id, data)
    } else {
      await createEvent(data)
    }
    setModal(null)
  }

  const handleDelete = async () => {
    if (modal?.event) {
      await deleteEvent(modal.event.id)
      setModal(null)
    }
  }

  const VIEW_TABS: { id: typeof view; label: string }[] = [
    { id: "month",  label: "Month"  },
    { id: "week",   label: "Week"   },
    { id: "day",    label: "Day"    },
    { id: "agenda", label: "Agenda" },
  ]

  const headerTitle = view === "month"  ? `${MONTHS[month]} ${year}`
    : view === "week"   ? `Week of ${MONTHS[month]} ${currentDate.getDate()}, ${year}`
    : view === "day"    ? `${MONTHS[month]} ${currentDate.getDate()}, ${year}`
    : `Agenda — ${MONTHS[month]} ${year}`

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", color: "var(--text-primary)", overflow: "hidden" }}>

      {/* ── Header bar ── */}
      <div style={{ padding: "16px 24px 12px", borderBottom: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0, flexWrap: "wrap" }}>
        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {[{ label: "‹", fn: goToPrev }, { label: "Today", fn: goToToday }, { label: "›", fn: goToNext }].map(({ label, fn }) => (
            <button key={label} onClick={fn} style={{ padding: label === "Today" ? "5px 12px" : "5px 10px", borderRadius: "var(--radius-md)", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)", fontSize: label === "Today" ? "11px" : "14px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.color = "var(--text-primary)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--glass-bg)"; e.currentTarget.style.color = "var(--text-secondary)" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Title */}
        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.2px", flex: 1 }}>
          {headerTitle}
        </div>

        {/* View tabs */}
        <div style={{ display: "flex", padding: "3px", borderRadius: "var(--radius-lg)", background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          {VIEW_TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setView(id)} style={{
              padding: "4px 12px", borderRadius: "var(--radius-md)", fontSize: "11px", fontWeight: 600,
              color: view === id ? "var(--text-primary)" : "var(--text-tertiary)",
              background: view === id ? "var(--glass-bg-hover)" : "transparent",
              border: `1px solid ${view === id ? "var(--glass-border-strong)" : "transparent"}`,
              cursor: "pointer", transition: "all 0.15s ease",
            }}>{label}</button>
          ))}
        </div>

        {/* Add button */}
        <button onClick={() => setModal({ date: selectedDate })} style={{
          padding: "7px 14px", borderRadius: "var(--radius-md)",
          background: "var(--accent)", border: "none",
          color: "white", fontSize: "12px", fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
          boxShadow: "0 0 14px var(--accent-glow)", transition: "all 0.15s ease",
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 0 20px var(--accent-glow)" }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 0 14px var(--accent-glow)" }}>
          <span style={{ fontSize: "14px", lineHeight: 1 }}>+</span> New
        </button>
      </div>

      {/* ── Calendar body ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        {view === "month" && (
          <MonthView year={year} month={month} events={events} activeDates={activeDates}
            selectedDate={selectedDate} tasksWithDates={tasksWithDates}
            onSelectDate={handleSelectDate} onEventClick={handleEventClick} />
        )}
        {view === "week" && (
          <WeekView anchorDate={currentDate} events={events} tasksWithDates={tasksWithDates}
            onSelectDate={handleSelectDate} onEventClick={handleEventClick} />
        )}
        {view === "day" && (
          <DayView date={selectedDate} events={events} tasksWithDates={tasksWithDates}
            onEventClick={handleEventClick} />
        )}
        {view === "agenda" && (
          <AgendaView events={events} tasksWithDates={tasksWithDates}
            onEventClick={handleEventClick} />
        )}
      </div>

      {/* ── Event modal ── */}
      {modal && (
        <EventModal
          date={modal.date}
          event={modal.event}
          onSave={handleSave}
          onDelete={modal.event ? handleDelete : undefined}
          onClose={() => setModal(null)}
        />
      )}

      <style>{`
        @keyframes settingsEnter {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}