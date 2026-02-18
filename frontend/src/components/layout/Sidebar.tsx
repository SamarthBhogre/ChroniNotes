import { useEffect, useRef, useState } from "react"
import UserProfileCard from "./UserProfileCard"

type Page = "dashboard" | "tasks" | "notes" | "timer"

interface Props {
  current: Page
  onChange: (page: Page) => void
}

const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "⬡" },
  { id: "tasks",     label: "Tasks",     icon: "◈" },
  { id: "notes",     label: "Notes",     icon: "◉" },
  { id: "timer",     label: "Timer",     icon: "⊹" },
]

/* Animate nav items in on first mount */
function useNavEntrance(count: number) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    refs.current.forEach((el, i) => {
      if (!el) return
      el.style.opacity = "0"
      el.style.transform = "translateX(-10px)"
      setTimeout(() => {
        el.style.transition = "opacity 0.3s ease, transform 0.3s cubic-bezier(0.22,1,0.36,1)"
        el.style.opacity = "1"
        el.style.transform = "translateX(0)"
      }, 80 + i * 55)
    })
  }, [])
  return refs
}

export default function Sidebar({ current, onChange }: Props) {
  const [pressed, setPressed] = useState<Page | null>(null)
  const navRefs = useNavEntrance(NAV_ITEMS.length)

  const handleClick = (id: Page) => {
    setPressed(id)
    setTimeout(() => setPressed(null), 180)
    onChange(id)
  }

  return (
    <aside
      className="relative z-20 flex flex-col flex-shrink-0"
      style={{
        width: "220px",
        marginTop: "40px",
        background: "rgba(255,255,255,0.03)",
        borderRight: "1px solid var(--glass-border)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
      }}
    >
      {/* ── Logo ── */}
      <div
        className="flex items-center gap-3 px-5 py-6"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: "30px", height: "30px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, var(--glow-a), var(--glow-b))",
            boxShadow: "0 0 16px var(--accent-glow)",
            fontSize: "14px",
            animation: "floatY 4s ease-in-out infinite",
          }}
        >
          ✦
        </div>
        <div>
          <div className="font-bold tracking-tight"
            style={{ fontSize: "13.5px", color: "var(--text-primary)" }}
          >
            ChroniNotes
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "1px" }}>
            Productivity Suite
          </div>
        </div>
      </div>

      {/* ── Section label ── */}
      <div
        className="px-5 pt-5 pb-2 font-semibold uppercase tracking-widest"
        style={{ fontSize: "9.5px", color: "var(--text-tertiary)" }}
      >
        Workspace
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3" style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {NAV_ITEMS.map(({ id, label, icon }, i) => {
          const isActive  = current === id
          const isPressed = pressed === id

          return (
            <button
              key={id}
              ref={el => { navRefs.current[i] = el }}
              onClick={() => handleClick(id)}
              className="w-full flex items-center gap-3 relative overflow-hidden"
              style={{
                padding: "9px 10px",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                background: isActive ? "var(--accent-dim)" : "transparent",
                border: `1px solid ${isActive ? "var(--accent-border)" : "transparent"}`,
                boxShadow: isActive ? "0 0 14px var(--accent-glow)" : "none",
                transform: isPressed
                  ? "scale(0.96) translateX(2px)"
                  : "translateX(0)",
                transition: "color 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s cubic-bezier(0.34,1.56,0.64,1)",
                textAlign: "left",
              }}
              onMouseEnter={e => {
                if (isActive) return
                e.currentTarget.style.background   = "var(--glass-bg-hover)"
                e.currentTarget.style.borderColor  = "var(--glass-border)"
                e.currentTarget.style.color        = "var(--text-primary)"
                e.currentTarget.style.transform    = "translateX(4px)"
                e.currentTarget.style.boxShadow    = "0 4px 16px rgba(0,0,0,0.2)"
              }}
              onMouseLeave={e => {
                if (isActive) return
                e.currentTarget.style.background   = "transparent"
                e.currentTarget.style.borderColor  = "transparent"
                e.currentTarget.style.color        = "var(--text-secondary)"
                e.currentTarget.style.transform    = "translateX(0)"
                e.currentTarget.style.boxShadow    = "none"
              }}
            >
              {/* Active left bar — slides in */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/4 bottom-1/4"
                  style={{
                    width: "3px",
                    borderRadius: "0 2px 2px 0",
                    background: "var(--accent)",
                    boxShadow: "0 0 10px var(--accent)",
                    animation: "slideInBar 0.25s cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                />
              )}

              {/* Active shimmer */}
              {isActive && (
                <span style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg, rgba(129,140,248,0.08) 0%, transparent 70%)",
                  pointerEvents: "none",
                  borderRadius: "inherit",
                }} />
              )}

              {/* Icon — bounces on active */}
              <span style={{
                fontSize: "15px", width: "20px",
                textAlign: "center", flexShrink: 0,
                opacity: isActive ? 1 : 0.65,
                display: "inline-block",
                transform: isActive ? "scale(1.18)" : "scale(1)",
                transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease",
              }}>
                {icon}
              </span>

              {/* Label */}
              <span style={{
                letterSpacing: isActive ? "0.01em" : "0",
                transition: "letter-spacing 0.2s ease",
              }}>
                {label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* ── User Profile Card ── */}
      <UserProfileCard />
    </aside>
  )
}