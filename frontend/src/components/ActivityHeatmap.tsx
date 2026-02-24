import type { DayActivity } from "../store/tasks.store"

interface Props {
  history: DayActivity[]
  weeks?: number
  label?: string
}

/* ── Build a full grid of the last N weeks ── */
function buildGrid(history: DayActivity[], weeks: number) {
  const map = new Map<string, number>()
  history.forEach(d => map.set(d.date, d.count))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Go back to the most recent Sunday
  const startDay = new Date(today)
  startDay.setDate(startDay.getDate() - startDay.getDay())
  // Go back (weeks - 1) more weeks
  startDay.setDate(startDay.getDate() - (weeks - 1) * 7)

  const grid: { date: string; count: number; isToday: boolean; isFuture: boolean }[][] = []

  for (let w = 0; w < weeks; w++) {
    const week: typeof grid[0] = []
    for (let d = 0; d < 7; d++) {
      const cell = new Date(startDay)
      cell.setDate(startDay.getDate() + w * 7 + d)
      const dateStr = cell.toISOString().split("T")[0]
      const isFuture = cell > today
      week.push({
        date: dateStr,
        count: isFuture ? 0 : (map.get(dateStr) ?? 0),
        isToday: dateStr === today.toISOString().split("T")[0],
        isFuture,
      })
    }
    grid.push(week)
  }

  return { grid, startDay }
}

/* ── Month labels ── */
function getMonthLabels(grid: ReturnType<typeof buildGrid>["grid"], _weeks: number) {
  const labels: { label: string; col: number }[] = []
  let lastMonth = -1
  for (let w = 0; w < grid.length; w++) {
    const month = new Date(grid[w][0].date).getMonth()
    if (month !== lastMonth) {
      labels.push({ label: new Date(grid[w][0].date).toLocaleString("default", { month: "short" }), col: w })
      lastMonth = month
    }
  }
  return labels
}

/* ── Color intensity based on count ── */
function getCellColor(count: number, isFuture: boolean, _isToday: boolean) {
  if (isFuture) return "var(--glass-bg)"
  if (count === 0) return "var(--glass-border-strong)"
  if (count === 1) return "var(--heatmap-1, rgba(99,102,241,0.25))"
  if (count === 2) return "var(--heatmap-2, rgba(99,102,241,0.45))"
  if (count === 3) return "var(--heatmap-3, rgba(99,102,241,0.65))"
  return "var(--heatmap-4, rgba(99,102,241,0.90))"
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const CELL = 12
const GAP  = 3

export default function ActivityHeatmap({ history, weeks = 26, label = "Task Completion Heatmap" }: Props) {
  const { grid } = buildGrid(history, weeks)
  const monthLabels = getMonthLabels(grid, weeks)
  const totalWidth  = weeks * (CELL + GAP) - GAP

  /* ── Stats ── */
  const totalCompleted = history.reduce((s, d) => s + d.count, 0)

  // Current streak — count consecutive days backwards from today with count > 0
  const map = new Map(history.map(d => [d.date, d.count]))
  let streak = 0
  const cur = new Date()
  while (true) {
    const d = cur.toISOString().split("T")[0]
    if ((map.get(d) ?? 0) > 0) {
      streak++
      cur.setDate(cur.getDate() - 1)
    } else break
  }

  // Busiest day
  const busiest = history.reduce((best, d) => d.count > (best?.count ?? 0) ? d : best, null as DayActivity | null)

  return (
    <div style={{
      padding: "20px 24px",
      borderRadius: "var(--radius-xl)",
      background: "var(--glass-bg)",
      border: "1px solid var(--glass-border)",
    }}>
      {/* Header row */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "16px", flexWrap: "wrap", gap: "8px",
      }}>
        <div>
          <div style={{
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.6px",
            textTransform: "uppercase", color: "var(--text-tertiary)",
            marginBottom: "3px",
          }}>Activity</div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
            {label}
          </div>
        </div>

        {/* Mini stats */}
        <div style={{ display: "flex", gap: "16px" }}>
          <StatPill label="Total" value={`${totalCompleted}`} />
          <StatPill label="Streak" value={`${streak}d`} highlight />
          {busiest && <StatPill label="Best day" value={`${busiest.count}`} />}
        </div>
      </div>

      {/* Scroll container for smaller windows */}
      <div style={{ overflowX: "auto", paddingBottom: "4px" }}>
        <div style={{ minWidth: `${totalWidth + 32}px` }}>

          {/* Month labels */}
          <div style={{
            display: "flex", marginLeft: "32px",
            marginBottom: "4px", position: "relative",
            height: "14px",
          }}>
            {monthLabels.map(({ label, col }) => (
              <div key={`${label}-${col}`} style={{
                position: "absolute",
                left: `${col * (CELL + GAP)}px`,
                fontSize: "9px", fontWeight: 600,
                color: "var(--text-tertiary)",
                whiteSpace: "nowrap",
              }}>
                {label}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          <div style={{ display: "flex", gap: "0" }}>
            {/* Day labels */}
            <div style={{
              display: "flex", flexDirection: "column",
              gap: `${GAP}px`, marginRight: "6px", flexShrink: 0,
            }}>
              {DAY_LABELS.map((d, i) => (
                <div key={d} style={{
                  height: `${CELL}px`, width: "24px",
                  fontSize: "8px", color: "var(--text-tertiary)",
                  display: "flex", alignItems: "center",
                  // Only show Mon / Wed / Fri to avoid crowding
                  visibility: (i === 1 || i === 3 || i === 5) ? "visible" : "hidden",
                }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Week columns */}
            <div style={{ display: "flex", gap: `${GAP}px` }}>
              {grid.map((week, wi) => (
                <div key={wi} style={{ display: "flex", flexDirection: "column", gap: `${GAP}px` }}>
                  {week.map((cell) => (
                    <div
                      key={cell.date}
                      title={cell.isFuture ? "" : `${cell.date}: ${cell.count} task${cell.count !== 1 ? "s" : ""} completed`}
                      style={{
                        width: `${CELL}px`, height: `${CELL}px`,
                        borderRadius: "2px",
                        background: getCellColor(cell.count, cell.isFuture, cell.isToday),
                        outline: cell.isToday ? "1.5px solid var(--accent)" : "none",
                        outlineOffset: "1px",
                        transition: "transform 0.12s ease, opacity 0.12s ease",
                        cursor: cell.isFuture || cell.count === 0 ? "default" : "pointer",
                        opacity: cell.isFuture ? 0.3 : 1,
                      }}
                      onMouseEnter={e => {
                        if (!cell.isFuture) e.currentTarget.style.transform = "scale(1.4)"
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = "scale(1)"
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "flex-end", gap: "5px",
            marginTop: "8px",
          }}>
            <span style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>Less</span>
            {[0, 1, 2, 3, 4].map(level => (
              <div key={level} style={{
                width: "10px", height: "10px", borderRadius: "2px",
                background: level === 0
                  ? "var(--glass-border-strong)"
                  : getCellColor(level, false, false),
              }} />
            ))}
            <span style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>More</span>
          </div>
        </div>
      </div>

      {/* Heatmap CSS vars — accent-colored intensity levels */}
      <style>{`
        :root,
        [data-theme="default"]    { --heatmap-1: rgba(99,102,241,0.25); --heatmap-2: rgba(99,102,241,0.45); --heatmap-3: rgba(99,102,241,0.65); --heatmap-4: rgba(99,102,241,0.90); }
        [data-theme="steel-blue"] { --heatmap-1: rgba(61,110,168,0.25); --heatmap-2: rgba(61,110,168,0.45); --heatmap-3: rgba(61,110,168,0.65); --heatmap-4: rgba(61,110,168,0.90); }
        [data-theme="warm-linen"] { --heatmap-1: rgba(122,106,94,0.20); --heatmap-2: rgba(122,106,94,0.38); --heatmap-3: rgba(122,106,94,0.58); --heatmap-4: rgba(122,106,94,0.82); }
        [data-theme="ember"]      { --heatmap-1: rgba(232,56,10,0.18);  --heatmap-2: rgba(232,56,10,0.38);  --heatmap-3: rgba(232,56,10,0.60);  --heatmap-4: rgba(232,56,10,0.85);  }
        [data-theme="carbon"]     { --heatmap-1: rgba(88,164,176,0.22); --heatmap-2: rgba(88,164,176,0.42); --heatmap-3: rgba(88,164,176,0.62); --heatmap-4: rgba(88,164,176,0.88); }
      `}</style>
    </div>
  )
}

/* ── Mini stat pill ── */
function StatPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        fontSize: "13px", fontWeight: 700,
        color: highlight ? "var(--accent)" : "var(--text-primary)",
      }}>{value}</div>
      <div style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: "1px" }}>{label}</div>
    </div>
  )
}