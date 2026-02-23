import { useEffect, useRef, useState } from "react"
import { useTasksStore } from "../store/tasks.store"
import ActivityHeatmap from "../components/ActivityHeatmap"

function useCardEntrance(count: number) {
  const refs = useRef<(HTMLDivElement | null)[]>([])
  useEffect(() => {
    refs.current.forEach((el, i) => {
      if (!el) return
      el.style.opacity = "0"
      el.style.transform = "translateY(16px) scale(0.98)"
      setTimeout(() => {
        el.style.transition = "opacity 0.35s ease, transform 0.35s cubic-bezier(0.22,1,0.36,1)"
        el.style.opacity = "1"
        el.style.transform = "translateY(0) scale(1)"
      }, 120 + i * 70)
    })
  }, [])
  return refs
}

const CARDS = [
  { icon: "◈", label: "Tasks Overview", desc: "Track your todos, in-progress, and completed tasks.", glow: "var(--glow-a)", accent: "var(--accent)", rgb: "99,102,241", page: "tasks" as const, stat: null, statColor: "var(--color-blue)" },
  { icon: "◉", label: "Recent Notes",   desc: "Your latest thoughts and writing, always at hand.",   glow: "var(--glow-b)", accent: "#a78bfa",       rgb: "139,92,246",  page: "notes" as const, stat: "Ready",        statColor: "#a78bfa" },
  { icon: "⊹", label: "Pomodoro Stats", desc: "Focus sessions, streaks, and productivity insights.", glow: "var(--glow-c)", accent: "#34d399",       rgb: "6,182,212",   page: "timer" as const, stat: "Start focus",  statColor: "#34d399" },
]

interface Props { onNavigate?: (page: "tasks" | "notes" | "timer") => void }
type DataView = "tasks" | "pomodoro"

function GoalRing({ completed, goal, size = 110 }: { completed: number; goal: number; size?: number }) {
  const stroke = 5, r = (size - stroke * 2) / 2, circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(goal > 0 ? completed / goal : 0, 1))
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--glass-border-strong)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)", filter: "drop-shadow(0 0 4px var(--accent-glow))" }}
      />
    </svg>
  )
}

export default function Dashboard({ onNavigate }: Props) {
  const cardRefs  = useCardEntrance(CARDS.length)
  const bannerRef = useRef<HTMLDivElement>(null)

  const [dataView, setDataView] = useState<DataView>(() =>
    (localStorage.getItem("chorniNotes-dataView") as DataView) ?? "tasks")
  const switchView = (v: DataView) => { setDataView(v); localStorage.setItem("chorniNotes-dataView", v) }

  const { tasks, loadTasks, completionHistory, loadCompletionHistory } = useTasksStore()
  useEffect(() => { loadTasks(); loadCompletionHistory() }, [])

  const activeTasks = tasks.length
  const doneTasks   = tasks.filter(t => t.status === "done").length
  const doingTasks  = tasks.filter(t => t.status === "doing").length
  const todoTasks   = tasks.filter(t => t.status === "todo").length

  const [focusHistory, setFocusHistory]         = useState<{ date: string; count: number; total_seconds: number }[]>([])
  const [todayMinutes, setTodayMinutes]         = useState(0)
  const [yesterdayMinutes, setYesterdayMinutes] = useState(0)

  useEffect(() => {
    window.electron.invoke("focus:history").then(setFocusHistory).catch(() => {})
    window.electron.invoke("focus:todayMinutes").then(setTodayMinutes).catch(() => {})
    window.electron.invoke("focus:yesterdayMinutes").then(setYesterdayMinutes).catch(() => {})
  }, [])

  const focusDayActivity = focusHistory.map(d => ({ date: d.date, count: d.count }))

  const [taskGoal,  setTaskGoal]  = useState(() => parseInt(localStorage.getItem("chorniNotes-dailyGoal")  ?? "5",   10))
  const [focusGoal, setFocusGoal] = useState(() => parseInt(localStorage.getItem("chorniNotes-focusGoal") ?? "120", 10))
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput,   setGoalInput]   = useState(0)

  const openEditGoal = () => { setGoalInput(dataView === "tasks" ? taskGoal : focusGoal); setEditingGoal(true) }
  const saveGoal = () => {
    const val = Math.max(1, goalInput)
    if (dataView === "tasks") { setTaskGoal(val);  localStorage.setItem("chorniNotes-dailyGoal",  String(val)) }
    else                      { setFocusGoal(val); localStorage.setItem("chorniNotes-focusGoal", String(val)) }
    setEditingGoal(false)
  }

  const todayStr = new Date().toISOString().split("T")[0]
  const yd = new Date(); yd.setDate(yd.getDate() - 1)
  const todayTasksDone      = completionHistory.find(d => d.date === todayStr)?.count ?? 0
  const yesterdayTasksDone  = completionHistory.find(d => d.date === yd.toISOString().split("T")[0])?.count ?? 0

  function calcStreak(history: { date: string; count: number }[]) {
    const map = new Map(history.map(d => [d.date, d.count]))
    let streak = 0, cur = new Date()
    while (true) {
      const d = cur.toISOString().split("T")[0]
      if ((map.get(d) ?? 0) > 0) { streak++; cur.setDate(cur.getDate() - 1) } else break
    }
    return streak
  }
  const taskStreak  = calcStreak(completionHistory)
  const focusStreak = calcStreak(focusDayActivity)

  const isPomodoro      = dataView === "pomodoro"
  const activeCompleted = isPomodoro ? todayMinutes    : todayTasksDone
  const activeYesterday = isPomodoro ? yesterdayMinutes : yesterdayTasksDone
  const activeGoal      = isPomodoro ? focusGoal       : taskGoal
  const activeStreak    = isPomodoro ? focusStreak     : taskStreak
  const activeHistory   = isPomodoro ? focusDayActivity : completionHistory
  const activeUnit      = isPomodoro ? "min"    : "tasks"
  const activeGoalUnit  = isPomodoro ? "min/day" : "tasks/day"

  useEffect(() => {
    const el = bannerRef.current; if (!el) return
    el.style.opacity = "0"; el.style.transform = "translateY(12px)"
    setTimeout(() => {
      el.style.transition = "opacity 0.4s ease, transform 0.4s cubic-bezier(0.22,1,0.36,1)"
      el.style.opacity = "1"; el.style.transform = "translateY(0)"
    }, 120 + CARDS.length * 70 + 60)
  }, [])

  const getStatLabel = (page: string, stat: string | null) =>
    page === "tasks" ? `${activeTasks} task${activeTasks !== 1 ? "s" : ""}` : stat ?? ""

  return (
    <div className="h-full" style={{ color: "var(--text-primary)", overflowY: "auto" }}>
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "56px 64px 40px" }}>

        {/* Header */}
        <div style={{ marginBottom: "40px" }}>
          <div className="inline-flex items-center gap-2 mb-4" style={{ padding: "4px 12px", borderRadius: "20px", background: "var(--accent-dim)", border: "1px solid var(--accent-border)", fontSize: "11px", fontWeight: 600, color: "var(--accent)", letterSpacing: "0.3px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-green)", boxShadow: "0 0 6px var(--color-green)", display: "inline-block", animation: "pulse-glow 2s ease-in-out infinite" }} />
            All systems active
          </div>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 700, letterSpacing: "-0.5px", lineHeight: 1.15, marginBottom: "10px", background: "linear-gradient(135deg, var(--text-primary) 40%, var(--accent))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Dashboard</h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6 }}>Your productivity overview — everything in one place.</p>
        </div>

        {/* Nav Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "28px" }}>
          {CARDS.map(({ icon, label, desc, glow, accent, rgb, page, stat, statColor }, i) => (
            <div key={label} ref={el => { cardRefs.current[i] = el }} className="glass" onClick={() => onNavigate?.(page)}
              style={{ borderRadius: "var(--radius-xl)", padding: "24px", position: "relative", overflow: "hidden", cursor: onNavigate ? "pointer" : "default", transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.22s cubic-bezier(0.34,1.56,0.64,1)" }}
              onMouseEnter={e => { if (!onNavigate) return; const el = e.currentTarget; el.style.background = "var(--glass-bg-hover)"; el.style.borderColor = `rgba(${rgb},0.25)`; el.style.boxShadow = `0 8px 32px rgba(${rgb},0.15), var(--glass-shadow)`; el.style.transform = "translateY(-3px) scale(1.01)" }}
              onMouseLeave={e => { const el = e.currentTarget; el.style.background = "var(--glass-bg)"; el.style.borderColor = "var(--glass-border)"; el.style.boxShadow = "var(--glass-shadow)"; el.style.transform = "translateY(0) scale(1)" }}
            >
              <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "120px", height: "120px", borderRadius: "50%", background: glow, opacity: 0.09, filter: "blur(30px)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 60%)", pointerEvents: "none", borderRadius: "inherit" }} />
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: `rgba(${rgb},0.14)`, border: `1px solid rgba(${rgb},0.28)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", marginBottom: "16px", color: accent, transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.15) rotate(-4deg)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1) rotate(0deg)" }}
              >{icon}</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>{label}</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: "20px" }}>{desc}</div>
              <div className="flex items-center">
                <button onClick={() => onNavigate?.(page)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "20px", background: `rgba(${rgb},0.10)`, border: `1px solid rgba(${rgb},0.20)`, fontSize: "11px", fontWeight: 700, color: statColor, cursor: "pointer", transition: "all 0.18s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = `rgba(${rgb},0.20)`; e.currentTarget.style.borderColor = `rgba(${rgb},0.45)`; e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = `0 0 12px rgba(${rgb},0.25)` }}
                  onMouseLeave={e => { e.currentTarget.style.background = `rgba(${rgb},0.10)`; e.currentTarget.style.borderColor = `rgba(${rgb},0.20)`; e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none" }}
                >
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: statColor, boxShadow: `0 0 5px ${statColor}`, display: "inline-block", animation: "pulse-glow 2.5s ease-in-out infinite", flexShrink: 0 }} />
                  <span key={getStatLabel(page, stat)} style={{ display: "inline-block", animation: "badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}>{getStatLabel(page, stat)}</span>
                  <span style={{ opacity: 0.6, fontSize: "10px" }}>→</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ══ DATA VIEW TOGGLE ══ */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-tertiary)", fontWeight: 500 }}>Activity data</div>
          <div style={{ display: "flex", padding: "3px", borderRadius: "var(--radius-lg)", background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            {(["tasks", "pomodoro"] as DataView[]).map(v => (
              <button key={v} onClick={() => switchView(v)} style={{
                padding: "5px 16px", borderRadius: "var(--radius-md)", fontSize: "11px", fontWeight: 600,
                color: dataView === v ? "var(--text-primary)" : "var(--text-tertiary)",
                background: dataView === v ? "var(--glass-bg-hover)" : "transparent",
                border: `1px solid ${dataView === v ? "var(--glass-border-strong)" : "transparent"}`,
                boxShadow: dataView === v ? "var(--glass-shadow)" : "none",
                transition: "all 0.2s ease", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "6px",
              }}>
                {v === "tasks" ? "◈" : "⊹"} {v === "tasks" ? "Tasks" : "Pomodoro"}
              </button>
            ))}
          </div>
        </div>

        {/* ══ WIDGETS ══ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>

          {/* Daily Progress Ring */}
          <div className="glass" style={{ borderRadius: "var(--radius-xl)", padding: "20px 24px", position: "relative", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "2px" }}>Daily Progress</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{isPomodoro ? "Focus Minutes" : "Task Completions"}</div>
              </div>
              <button onClick={openEditGoal} title="Edit daily goal"
                style={{ width: "28px", height: "28px", borderRadius: "7px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.color = "var(--accent)" }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--glass-bg)"; e.currentTarget.style.color = "var(--text-tertiary)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <GoalRing completed={activeCompleted} goal={activeGoal} size={110} />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  {editingGoal ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                      <input type="number" value={goalInput} min={1}
                        onChange={e => setGoalInput(+e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") setEditingGoal(false) }}
                        autoFocus
                        style={{ width: "50px", textAlign: "center", fontSize: "15px", fontWeight: 700, background: "var(--glass-bg)", border: "1px solid var(--accent-border)", borderRadius: "6px", color: "var(--text-primary)", padding: "2px 0" }}
                      />
                      <button onClick={saveGoal} style={{ fontSize: "9px", fontWeight: 600, color: "var(--accent)", background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}>Save</button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: "22px", fontWeight: 700, lineHeight: 1, color: "var(--text-primary)" }}>{activeCompleted}</span>
                      <span style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: "2px" }}>of {activeGoal} {activeUnit}</span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                <MiniStat label="Yesterday" value={`${activeYesterday}`} unit={activeUnit} />
                <div style={{ height: "1px", background: "var(--glass-border)" }} />
                <MiniStat label="Daily goal" value={`${activeGoal}`} unit={activeGoalUnit} accent />
                <div style={{ height: "1px", background: "var(--glass-border)" }} />
                <MiniStat label="Progress" value={activeGoal > 0 ? `${Math.round((activeCompleted / activeGoal) * 100)}%` : "0%"} unit="" accent={activeCompleted >= activeGoal && activeGoal > 0} />
              </div>
            </div>

            <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "center" }}>
              <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                {isPomodoro ? "Today's focus: " : "Completed today: "}
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>{activeCompleted} {activeUnit}</span>
                {activeCompleted >= activeGoal && activeGoal > 0 && activeCompleted > 0 && <span style={{ marginLeft: "6px" }}>🎉</span>}
              </span>
            </div>
          </div>

          {/* Streak + breakdown */}
          <div className="glass" style={{ borderRadius: "var(--radius-xl)", padding: "20px 24px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "2px" }}>Overview</div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "16px" }}>{isPomodoro ? "Focus Stats" : "Task Stats"}</div>

            <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", borderRadius: "var(--radius-lg)", background: activeStreak > 0 ? "var(--accent-dim)" : "var(--glass-bg)", border: `1px solid ${activeStreak > 0 ? "var(--accent-border)" : "var(--glass-border)"}`, marginBottom: "14px", transition: "all 0.3s ease" }}>
              <div style={{ fontSize: "28px", lineHeight: 1 }}>{activeStreak >= 7 ? "🔥" : activeStreak >= 3 ? "⚡" : activeStreak > 0 ? "✦" : "○"}</div>
              <div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: activeStreak > 0 ? "var(--accent)" : "var(--text-secondary)", lineHeight: 1 }}>
                  {activeStreak}<span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-tertiary)", marginLeft: "4px" }}>day{activeStreak !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                  {activeStreak === 0 ? (isPomodoro ? "Complete a session to start" : "Complete a task to start") : activeStreak >= 7 ? "You're on fire! 🔥" : "Current streak"}
                </div>
              </div>
            </div>

            {isPomodoro ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <MiniStat label="Sessions today" value={`${focusHistory.find(d => d.date === todayStr)?.count ?? 0}`} unit="sessions" />
                <div style={{ height: "1px", background: "var(--glass-border)" }} />
                <MiniStat label="Focus today" value={`${todayMinutes}`} unit="min" accent />
                <div style={{ height: "1px", background: "var(--glass-border)" }} />
                <MiniStat label="Total sessions" value={`${focusHistory.reduce((s, d) => s + d.count, 0)}`} unit="all time" />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { label: "To do", count: todoTasks, color: "var(--text-tertiary)", bar: "var(--glass-border-strong)" },
                  { label: "In progress", count: doingTasks, color: "var(--color-yellow)", bar: "var(--color-yellow)" },
                  { label: "Done", count: doneTasks, color: "var(--color-green)", bar: "var(--color-green)" },
                ].map(({ label, count, color, bar }) => {
                  const pct = activeTasks > 0 ? (count / activeTasks) * 100 : 0
                  return (
                    <div key={label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{label}</span>
                        <span style={{ fontSize: "11px", fontWeight: 600, color }}>{count}</span>
                      </div>
                      <div style={{ height: "3px", borderRadius: "2px", background: "var(--glass-border-strong)", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: "2px", width: `${pct}%`, background: bar, transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)" }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Heatmap */}
        <div style={{ marginBottom: "20px" }}>
          <ActivityHeatmap
            history={activeHistory}
            weeks={26}
            label={isPomodoro ? "Pomodoro Session Heatmap" : "Task Completion Heatmap"}
          />
        </div>

        {/* Banner */}
        <div ref={bannerRef} className="glass" style={{ borderRadius: "var(--radius-xl)", padding: "20px 24px", display: "flex", alignItems: "center", gap: "16px", borderColor: "var(--accent-border)", background: "var(--accent-dim)" }}>
          <div style={{ fontSize: "22px", flexShrink: 0, animation: "spinSlow 8s linear infinite" }}>✦</div>
          <div>
            <div style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--accent)", marginBottom: "3px" }}>Get started</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.55 }}>
              Head to <NavLink label="Notes" onClick={() => onNavigate?.("notes")} />,{" "}
              <NavLink label="Tasks" onClick={() => onNavigate?.("tasks")} />, or{" "}
              <NavLink label="Timer" onClick={() => onNavigate?.("timer")} /> to start your session.
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function MiniStat({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 700, color: accent ? "var(--accent)" : "var(--text-primary)" }}>
        {value} <span style={{ fontSize: "9px", fontWeight: 500, color: "var(--text-tertiary)" }}>{unit}</span>
      </span>
    </div>
  )
}

function NavLink({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <strong onClick={onClick}
      style={{ color: "var(--text-primary)", cursor: onClick ? "pointer" : "default", transition: "color 0.15s", textDecoration: "underline", textDecorationColor: "var(--accent-border)", textUnderlineOffset: "2px" }}
      onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)" }}
      onMouseLeave={e => { e.currentTarget.style.color = "var(--text-primary)" }}
    >{label}</strong>
  )
}