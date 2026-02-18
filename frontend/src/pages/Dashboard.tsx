import { useEffect, useRef } from "react"
import { useTasksStore } from "../store/tasks.store"

/* ── Staggered card entrance ── */
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
  {
    icon: "◈", label: "Tasks Overview",
    desc: "Track your todos, in-progress, and completed tasks.",
    glow: "var(--glow-a)", accent: "var(--accent)",
    rgb: "99,102,241", page: "tasks" as const,
    stat: null,           // ← resolved dynamically from store
    statColor: "var(--color-blue)",
  },
  {
    icon: "◉", label: "Recent Notes",
    desc: "Your latest thoughts and writing, always at hand.",
    glow: "var(--glow-b)", accent: "#a78bfa",
    rgb: "139,92,246", page: "notes" as const,
    stat: "Ready",        statColor: "#a78bfa",
  },
  {
    icon: "⊹", label: "Pomodoro Stats",
    desc: "Focus sessions, streaks, and productivity insights.",
    glow: "var(--glow-c)", accent: "#34d399",
    rgb: "6,182,212", page: "timer" as const,
    stat: "Start focus",  statColor: "#34d399",
  },
]

interface Props {
  onNavigate?: (page: "tasks" | "notes" | "timer") => void
}

export default function Dashboard({ onNavigate }: Props) {
  const cardRefs  = useCardEntrance(CARDS.length)
  const bannerRef = useRef<HTMLDivElement>(null)

  /* ── Live task count from store ── */
  const { tasks, loadTasks } = useTasksStore()
  useEffect(() => { loadTasks() }, [])
  const activeTasks = tasks.length

  /* Resolve stat label — Tasks is live, others use static string */
  const getStatLabel = (page: string, stat: string | null) => {
    if (page === "tasks") return `${activeTasks} task${activeTasks !== 1 ? "s" : ""}`
    return stat ?? ""
  }

  /* Banner entrance — slightly delayed */
  useEffect(() => {
    const el = bannerRef.current
    if (!el) return
    el.style.opacity = "0"
    el.style.transform = "translateY(12px)"
    setTimeout(() => {
      el.style.transition = "opacity 0.4s ease, transform 0.4s cubic-bezier(0.22,1,0.36,1)"
      el.style.opacity = "1"
      el.style.transform = "translateY(0)"
    }, 120 + CARDS.length * 70 + 60)
  }, [])

  return (
    <div className="h-full" style={{ color: "var(--text-primary)" }}>
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "56px 64px 40px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: "40px" }}>
          <div
            className="inline-flex items-center gap-2 mb-4"
            style={{
              padding: "4px 12px", borderRadius: "20px",
              background: "var(--accent-dim)",
              border: "1px solid var(--accent-border)",
              fontSize: "11px", fontWeight: 600,
              color: "var(--accent)", letterSpacing: "0.3px",
            }}
          >
            <span style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: "var(--color-green)",
              boxShadow: "0 0 6px var(--color-green)",
              display: "inline-block",
              animation: "pulse-glow 2s ease-in-out infinite",
            }} />
            All systems active
          </div>

          <h1 style={{
            fontSize: "2.4rem", fontWeight: 700,
            letterSpacing: "-0.5px", lineHeight: 1.15, marginBottom: "10px",
            background: "linear-gradient(135deg, var(--text-primary) 40%, var(--accent))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Dashboard
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Your productivity overview — everything in one place.
          </p>
        </div>

        {/* ── Cards ── */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px", marginBottom: "24px",
        }}>
          {CARDS.map(({ icon, label, desc, glow, accent, rgb, page, stat, statColor }, i) => (
            <div
              key={label}
              ref={el => { cardRefs.current[i] = el }}
              className="glass"
              onClick={() => onNavigate?.(page)}
              style={{
                borderRadius: "var(--radius-xl)", padding: "24px",
                position: "relative", overflow: "hidden",
                cursor: onNavigate ? "pointer" : "default",
                transition: "background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1)",
              }}
              onMouseEnter={e => {
                if (!onNavigate) return
                const el = e.currentTarget
                el.style.background    = "var(--glass-bg-hover)"
                el.style.borderColor   = `rgba(${rgb},0.25)`
                el.style.boxShadow     = `0 8px 32px rgba(${rgb},0.15), var(--glass-shadow)`
                el.style.transform     = "translateY(-3px) scale(1.01)"
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                el.style.background    = "var(--glass-bg)"
                el.style.borderColor   = "var(--glass-border)"
                el.style.boxShadow     = "var(--glass-shadow)"
                el.style.transform     = "translateY(0) scale(1)"
              }}
            >
              {/* Corner glow */}
              <div style={{
                position: "absolute", top: "-40px", right: "-40px",
                width: "120px", height: "120px", borderRadius: "50%",
                background: glow, opacity: 0.09,
                filter: "blur(30px)", pointerEvents: "none",
              }} />

              {/* Shimmer */}
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 60%)",
                pointerEvents: "none", borderRadius: "inherit",
              }} />

              {/* Icon badge */}
              <div style={{
                width: "40px", height: "40px", borderRadius: "10px",
                background: `rgba(${rgb},0.14)`,
                border: `1px solid rgba(${rgb},0.28)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "18px", marginBottom: "16px", color: accent,
                transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.15) rotate(-4deg)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1) rotate(0deg)" }}
              >
                {icon}
              </div>

              <div style={{
                fontSize: "13px", fontWeight: 700,
                color: "var(--text-primary)", marginBottom: "6px",
                letterSpacing: "-0.1px",
              }}>
                {label}
              </div>
              <div style={{
                fontSize: "12px", color: "var(--text-secondary)",
                lineHeight: 1.55, marginBottom: "20px",
              }}>
                {desc}
              </div>

              {/* ✅ Stat pill IS the button — live for tasks, static for others */}
              <div className="flex items-center">
                <button
                  onClick={() => onNavigate?.(page)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    padding: "5px 12px", borderRadius: "20px",
                    background: `rgba(${rgb},0.10)`,
                    border: `1px solid rgba(${rgb},0.20)`,
                    fontSize: "11px", fontWeight: 700,
                    color: statColor, letterSpacing: "0.2px",
                    cursor: "pointer",
                    transition: "background 0.18s ease, border-color 0.18s ease, transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background   = `rgba(${rgb},0.20)`
                    e.currentTarget.style.borderColor  = `rgba(${rgb},0.45)`
                    e.currentTarget.style.transform    = "scale(1.05)"
                    e.currentTarget.style.boxShadow    = `0 0 12px rgba(${rgb},0.25)`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background   = `rgba(${rgb},0.10)`
                    e.currentTarget.style.borderColor  = `rgba(${rgb},0.20)`
                    e.currentTarget.style.transform    = "scale(1)"
                    e.currentTarget.style.boxShadow    = "none"
                  }}
                >
                  <span style={{
                    width: "5px", height: "5px", borderRadius: "50%",
                    background: statColor,
                    boxShadow: `0 0 5px ${statColor}`,
                    display: "inline-block",
                    animation: "pulse-glow 2.5s ease-in-out infinite",
                    flexShrink: 0,
                  }} />
                  {/* Key forces re-render + badgePop when count changes */}
                  <span key={getStatLabel(page, stat)} style={{
                    display: "inline-block",
                    animation: "badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                  }}>
                    {getStatLabel(page, stat)}
                  </span>
                  <span style={{ opacity: 0.6, fontSize: "10px" }}>→</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Get started banner ── */}
        <div
          ref={bannerRef}
          className="glass"
          style={{
            borderRadius: "var(--radius-xl)", padding: "20px 24px",
            display: "flex", alignItems: "center", gap: "16px",
            borderColor: "var(--accent-border)",
            background: "var(--accent-dim)",
          }}
        >
          {/* Spinning star */}
          <div style={{
            fontSize: "22px", flexShrink: 0,
            animation: "spinSlow 8s linear infinite",
          }}>
            ✦
          </div>
          <div>
            <div style={{
              fontSize: "12.5px", fontWeight: 700,
              color: "var(--accent)", marginBottom: "3px",
            }}>
              Get started
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.55 }}>
              Head to{" "}
              <NavLink label="Notes"  onClick={() => onNavigate?.("notes")} />,{" "}
              <NavLink label="Tasks"  onClick={() => onNavigate?.("tasks")} />, or{" "}
              <NavLink label="Timer"  onClick={() => onNavigate?.("timer")} />{" "}
              to start your session.
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

/* ── Inline nav link ── */
function NavLink({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <strong
      onClick={onClick}
      style={{
        color: "var(--text-primary)",
        cursor: onClick ? "pointer" : "default",
        transition: "color 0.15s",
        textDecoration: "underline",
        textDecorationColor: "var(--accent-border)",
        textUnderlineOffset: "2px",
      }}
      onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)" }}
      onMouseLeave={e => { e.currentTarget.style.color = "var(--text-primary)" }}
    >
      {label}
    </strong>
  )
}