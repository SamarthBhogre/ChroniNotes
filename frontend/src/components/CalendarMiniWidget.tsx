import { useEffect, useState } from "react"
import { useCalendarStore } from "../store/calendar.store"

const DAYS_SHORT = ["S","M","T","W","T","F","S"]
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

const TYPE_DOTS: Record<string, string> = {
  event: "#6366f1", reminder: "#f59e0b", focus: "#10b981", task: "#8b5cf6",
}

interface Props {
  onNavigate?: () => void   // navigates to full Calendar page
}

export default function CalendarMiniWidget({ onNavigate }: Props) {
  const { activeDates, loadActiveDates } = useCalendarStore()

  // Compute today fresh on every render so the highlight always tracks the
  // real current date even when the app is left open past midnight.
  const now       = new Date()
  const todayStr  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const mk = `${year}-${String(month + 1).padStart(2, "0")}`

  useEffect(() => { loadActiveDates(mk) }, [mk])

  const totalDays  = new Date(year, month + 1, 0).getDate()
  const startDay   = new Date(year, month, 1).getDay()
  const totalCells = Math.ceil((startDay + totalDays) / 7) * 7

  // Build a map of date -> types for dot rendering
  const dotMap = activeDates.reduce<Record<string, Set<string>>>((acc, d) => {
    if (!acc[d.date]) acc[d.date] = new Set()
    acc[d.date].add(d.type)
    return acc
  }, {})

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  return (
    <div className="glass" style={{ borderRadius: "var(--radius-xl)", padding: "14px 16px", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "1px" }}>Calendar</div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
            {MONTHS[month]} {year}
          </div>
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {[{ label: "‹", fn: prevMonth }, { label: "›", fn: nextMonth }].map(({ label, fn }) => (
            <button key={label} onClick={fn} style={{
              width: "22px", height: "22px", borderRadius: "5px",
              background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
              color: "var(--text-tertiary)", fontSize: "13px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s ease",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.color = "var(--text-primary)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--glass-bg)"; e.currentTarget.style.color = "var(--text-tertiary)" }}>
              {label}
            </button>
          ))}
          {onNavigate && (
            <button onClick={onNavigate} title="Open full calendar" style={{
              width: "22px", height: "22px", borderRadius: "5px",
              background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
              color: "var(--accent)", fontSize: "11px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s ease",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "white" }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--accent-dim)"; e.currentTarget.style.color = "var(--accent)" }}>
              ↗
            </button>
          )}
        </div>
      </div>

      {/* Day labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "4px" }}>
        {DAYS_SHORT.map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: "9px", fontWeight: 700, color: "var(--text-tertiary)", padding: "2px 0" }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px" }}>
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum  = idx - startDay + 1
          const valid   = dayNum >= 1 && dayNum <= totalDays
          const dateStr = valid ? `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}` : ""
          const isToday = dateStr === todayStr
          const types   = valid ? dotMap[dateStr] : undefined

          return (
            <div key={idx} style={{
              aspectRatio: "1", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              borderRadius: "4px", position: "relative",
              background: isToday ? "var(--accent)" : "transparent",
              cursor: valid ? "pointer" : "default",
              transition: "background 0.15s ease",
            }}
              onMouseEnter={e => { if (valid && !isToday) e.currentTarget.style.background = "var(--glass-bg-hover)" }}
              onMouseLeave={e => { if (!isToday) e.currentTarget.style.background = "transparent" }}
              onClick={() => { if (valid && onNavigate) onNavigate() }}
            >
              {valid && (
                <>
                  <span style={{ fontSize: "10px", fontWeight: isToday ? 700 : 400, color: isToday ? "white" : "var(--text-primary)", lineHeight: 1 }}>
                    {dayNum}
                  </span>
                  {types && types.size > 0 && (
                    <div style={{ display: "flex", gap: "1px", marginTop: "1px", position: "absolute", bottom: "2px" }}>
                      {Array.from(types).slice(0, 3).map(t => (
                        <div key={t} style={{ width: "3px", height: "3px", borderRadius: "50%", background: isToday ? "rgba(255,255,255,0.8)" : (TYPE_DOTS[t] ?? "var(--accent)") }} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid var(--glass-border)", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {Object.entries(TYPE_DOTS).map(([type, color]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: color }} />
            <span style={{ fontSize: "9px", color: "var(--text-tertiary)", textTransform: "capitalize", fontWeight: 600 }}>{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}