import { useState } from "react"

interface TopbarProps {
  title?: string
  onOpenSettings?: () => void
}

export default function Topbar({ title = "ChorniNotes", onOpenSettings }: TopbarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const handleMinimize = () => window.electron?.invoke("window-minimize")
  const handleMaximize = () => {
    window.electron?.invoke("window-maximize")
    setIsMaximized(!isMaximized)
  }
  const handleClose = () => window.electron?.invoke("window-close")

  return (
    <div
      className="topbar"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "40px",
        zIndex: 1000, display: "flex", alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: "16px", paddingRight: "4px",
        background: "var(--topbar-bg, rgba(12, 15, 30, 0.85))",
        borderBottom: "1px solid var(--glass-border)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        WebkitAppRegion: "drag" as any,
        transition: "background 0.4s ease",
      }}
    >
      {/* Left side */}
      <div style={{
        display: "flex", alignItems: "center", gap: "12px",
        color: "var(--text-primary)", fontSize: "var(--font-size-sm)", fontWeight: 600,
      }}>
        {/* Menu button */}
        <div style={{ position: "relative", WebkitAppRegion: "no-drag" as any }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            aria-label="Menu"
            style={{
              width: "32px", height: "32px", borderRadius: "6px",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-secondary)",
              background: showMenu ? "var(--glass-bg-hover)" : "transparent",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => { if (!showMenu) e.currentTarget.style.background = "var(--glass-bg-hover)" }}
            onMouseLeave={e => { if (!showMenu) e.currentTarget.style.background = "transparent" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4.5H14M2 8H14M2 11.5H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {/* Dropdown */}
          {showMenu && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 999 }}
                onClick={() => setShowMenu(false)}
              />
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0,
                minWidth: "200px", borderRadius: "var(--radius-md)", padding: "6px",
                zIndex: 1000, animation: "menuSlideIn 0.15s ease",
                background: "var(--modal-bg, rgba(16, 19, 36, 0.95))",
                border: "1px solid var(--glass-border-strong)",
                backdropFilter: "blur(24px) saturate(160%)",
                WebkitBackdropFilter: "blur(24px) saturate(160%)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.08)",
              }}>
                {/* Settings — wired to open modal */}
                <MenuItem
                  onClick={() => {
                    setShowMenu(false)
                    onOpenSettings?.()
                  }}
                  icon={
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  }
                >
                  Settings
                </MenuItem>

                <MenuItem
                  onClick={() => {
                    setShowMenu(false)
                    window.electron?.invoke("notes:openFolder")
                  }}
                  icon={
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  }
                >
                  Open Notes Folder
                </MenuItem>

                <MenuItem
                  onClick={() => setShowMenu(false)}
                  icon={
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  }
                >
                  Export Data
                </MenuItem>

                <div style={{ height: "1px", background: "var(--glass-border)", margin: "4px 0" }} />

                <MenuItem
                  onClick={() => setShowMenu(false)}
                  icon={
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  }
                >
                  About
                </MenuItem>
              </div>
            </>
          )}
        </div>

        {/* App icon */}
        <div style={{
          width: "20px", height: "20px", borderRadius: "6px",
          background: "linear-gradient(135deg, var(--accent), var(--glow-b))",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "12px", fontWeight: 700, color: "white",
          boxShadow: "0 2px 8px var(--accent-glow)",
          transition: "box-shadow 0.3s ease",
        }}>C</div>
        <span style={{ transition: "color 0.3s ease" }}>{title}</span>
      </div>

      {/* Right side — window controls */}
      <div style={{
        display: "flex", alignItems: "center",
        WebkitAppRegion: "no-drag" as any,
      }}>
        <button onClick={handleMinimize} className="window-control-btn" aria-label="Minimize">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <button onClick={handleMaximize} className="window-control-btn" aria-label={isMaximized ? "Restore" : "Maximize"}>
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 4V2.5H10.5V10H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="1.5" y="3.5" width="7" height="7" stroke="currentColor" strokeWidth="1.5" rx="0.5" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1.5" rx="1" />
            </svg>
          )}
        </button>

        <button onClick={handleClose} className="window-control-btn window-control-close" aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ── Menu Item ── */
function MenuItem({
  children, onClick, icon,
}: {
  children: React.ReactNode
  onClick: () => void
  icon?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: "10px",
        padding: "8px 12px", borderRadius: "4px",
        fontSize: "var(--font-size-sm)", color: "var(--text-primary)",
        background: "transparent", textAlign: "left", transition: "all 0.15s ease",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "var(--glass-bg-hover)"
        e.currentTarget.style.color = "var(--accent)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "transparent"
        e.currentTarget.style.color = "var(--text-primary)"
      }}
    >
      {icon && (
        <span style={{ opacity: 0.7, flexShrink: 0, display: "flex", alignItems: "center" }}>
          {icon}
        </span>
      )}
      {children}
    </button>
  )
}