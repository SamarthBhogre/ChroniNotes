import { useEffect, useRef, useState } from "react"
import UserProfileCard from "./UserProfileCard"

type Page = "dashboard" | "tasks" | "notes" | "timer" | "calendar"

interface Props {
  current: Page
  onChange: (page: Page) => void
}

const NAV_ITEMS: { id: Page; label: string; icon: string; shortcut?: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "⬡", shortcut: "1" },
  { id: "tasks",     label: "Tasks",     icon: "◈", shortcut: "2" },
  { id: "notes",     label: "Notes",     icon: "◉", shortcut: "3" },
  { id: "timer",     label: "Timer",     icon: "⊹", shortcut: "4" },
  { id: "calendar",  label: "Calendar",  icon: "▦", shortcut: "5" },
]

function useNavEntrance(_count: number) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    refs.current.forEach((el, i) => {
      if (!el) return
      el.style.opacity = "0"
      el.style.transform = "translateX(-8px)"
      setTimeout(() => {
        el.style.transition = "opacity 0.25s ease, transform 0.25s cubic-bezier(0.22,1,0.36,1)"
        el.style.opacity = "1"
        el.style.transform = "translateX(0)"
      }, 60 + i * 45)
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

  // Keyboard shortcuts: Ctrl+1-5
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        const num = parseInt(e.key)
        if (num >= 1 && num <= NAV_ITEMS.length) {
          e.preventDefault()
          handleClick(NAV_ITEMS[num - 1].id)
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <aside style={{
      width: "200px", flexShrink: 0,
      marginTop: "40px",
      background: "rgba(255,255,255,0.02)",
      borderRight: "1px solid var(--glass-border)",
      display: "flex", flexDirection: "column",
      position: "relative", zIndex: 20,
    }}>
      {/* ── Logo ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "16px 16px 14px",
        borderBottom: "1px solid var(--glass-border)",
      }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
          background: "linear-gradient(135deg, var(--glow-a), var(--glow-b))",
          boxShadow: "0 0 12px var(--accent-glow)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "13px", color: "white",
          animation: "floatY 4s ease-in-out infinite",
        }}>✦</div>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>ChroniNotes</div>
          <div style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: "0px" }}>Productivity Suite</div>
        </div>
      </div>

      {/* ── Section label ── */}
      <div style={{
        padding: "14px 16px 6px",
        fontSize: "9px", fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "1px",
        color: "var(--text-tertiary)",
      }}>
        Workspace
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: "0 8px", display: "flex", flexDirection: "column", gap: "1px" }}>
        {NAV_ITEMS.map(({ id, label, icon, shortcut }, i) => {
          const isActive  = current === id
          const isPressed = pressed === id

          return (
            <button
              key={id}
              ref={el => { navRefs.current[i] = el }}
              onClick={() => handleClick(id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 8px", borderRadius: "8px",
                fontSize: "12.5px", fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                background: isActive ? "var(--accent-dim)" : "transparent",
                border: `1px solid ${isActive ? "var(--accent-border)" : "transparent"}`,
                boxShadow: isActive ? "0 0 10px var(--accent-glow)" : "none",
                transform: isPressed ? "scale(0.97)" : "translateX(0)",
                transition: "color 0.15s, background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.15s cubic-bezier(0.34,1.56,0.64,1)",
                textAlign: "left", position: "relative", overflow: "hidden",
              }}
              onMouseEnter={e => {
                if (isActive) return
                e.currentTarget.style.background  = "var(--glass-bg-hover)"
                e.currentTarget.style.borderColor = "var(--glass-border)"
                e.currentTarget.style.color       = "var(--text-primary)"
                e.currentTarget.style.transform   = "translateX(2px)"
              }}
              onMouseLeave={e => {
                if (isActive) return
                e.currentTarget.style.background  = "transparent"
                e.currentTarget.style.borderColor = "transparent"
                e.currentTarget.style.color       = "var(--text-secondary)"
                e.currentTarget.style.transform   = "translateX(0)"
              }}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span style={{
                  position: "absolute", left: 0, top: "25%", bottom: "25%",
                  width: "2.5px", borderRadius: "0 2px 2px 0",
                  background: "var(--accent)", boxShadow: "0 0 8px var(--accent)",
                  animation: "slideInBar 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                }} />
              )}

              {/* Icon */}
              <span style={{
                fontSize: "14px", width: "18px", textAlign: "center", flexShrink: 0,
                opacity: isActive ? 1 : 0.6, display: "inline-block",
                transform: isActive ? "scale(1.1)" : "scale(1)",
                transition: "transform 0.2s, opacity 0.15s",
              }}>{icon}</span>

              {/* Label */}
              <span style={{ flex: 1 }}>{label}</span>

              {/* Shortcut hint */}
              {shortcut && !isActive && (
                <span style={{
                  fontSize: "9px", fontWeight: 500, color: "var(--text-tertiary)",
                  opacity: 0.5, padding: "1px 4px", borderRadius: "3px",
                  background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                  fontFamily: "monospace", lineHeight: 1.3,
                }}>⌃{shortcut}</span>
              )}
            </button>
          )
        })}
      </nav>

      <UserProfileCard />
    </aside>
  )
}
