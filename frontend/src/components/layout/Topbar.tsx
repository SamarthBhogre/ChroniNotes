import { useState } from "react"

interface TopbarProps {
  title?: string
}

export default function Topbar({ title = "ChorniNotes" }: TopbarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const handleMinimize = () => {
    window.electron?.invoke("window-minimize")
  }

  const handleMaximize = () => {
    window.electron?.invoke("window-maximize")
    setIsMaximized(!isMaximized)
  }

  const handleClose = () => {
    window.electron?.invoke("window-close")
  }

  return (
    <div
      className="topbar"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "40px",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: "16px",
        paddingRight: "4px",
        background: "rgba(12, 15, 30, 0.85)",
        borderBottom: "1px solid var(--glass-border)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        WebkitAppRegion: "drag" as any,
      }}
    >
      {/* Left side - Menu & App title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          color: "var(--text-primary)",
          fontSize: "var(--font-size-sm)",
          fontWeight: 600,
        }}
      >
        {/* Menu button */}
        <div style={{ position: "relative", WebkitAppRegion: "no-drag" as any }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="menu-btn"
            aria-label="Menu"
            title="Menu"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
              background: showMenu ? "var(--glass-bg-hover)" : "transparent",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!showMenu) e.currentTarget.style.background = "var(--glass-bg-hover)"
            }}
            onMouseLeave={(e) => {
              if (!showMenu) e.currentTarget.style.background = "transparent"
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 4.5H14M2 8H14M2 11.5H14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <>
              {/* Backdrop to close menu */}
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 999,
                }}
                onClick={() => setShowMenu(false)}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  minWidth: "200px",
                  borderRadius: "var(--radius-md)",
                  padding: "6px",
                  zIndex: 1000,
                  animation: "menuSlideIn 0.15s ease",
                  background: "rgba(16, 19, 36, 0.95)",
                  border: "1px solid var(--glass-border-strong)",
                  backdropFilter: "blur(24px) saturate(160%)",
                  WebkitBackdropFilter: "blur(24px) saturate(160%)",
                  boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255,255,255,0.08)",
                }}
              >
                <MenuItem onClick={() => setShowMenu(false)}>
                  <span>⚙️</span>
                  Settings
                </MenuItem>
                <MenuItem onClick={() => {
                  setShowMenu(false)
                  window.electron?.invoke("notes:openFolder")
                }}>
                  <span>📁</span>
                  Open Notes Folder
                </MenuItem>
                <MenuItem onClick={() => setShowMenu(false)}>
                  <span>📊</span>
                  Export Data
                </MenuItem>
                <div
                  style={{
                    height: "1px",
                    background: "var(--glass-border)",
                    margin: "4px 0",
                  }}
                />
                <MenuItem onClick={() => setShowMenu(false)}>
                  <span>ℹ️</span>
                  About
                </MenuItem>
              </div>
            </>
          )}
        </div>

        {/* App icon/logo */}
        <div
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "6px",
            background: "linear-gradient(135deg, var(--accent), var(--glow-b))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: 700,
            color: "white",
            boxShadow: "0 2px 8px var(--accent-glow)",
          }}
        >
          C
        </div>
        <span>{title}</span>
      </div>

      {/* Right side - Window controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          WebkitAppRegion: "no-drag" as any,
        }}
      >
        {/* Minimize button */}
        <button
          onClick={handleMinimize}
          className="window-control-btn"
          aria-label="Minimize"
          title="Minimize"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 6H10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Maximize/Restore button */}
        <button
          onClick={handleMaximize}
          className="window-control-btn"
          aria-label={isMaximized ? "Restore" : "Maximize"}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 4V2.5H10.5V10H9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="1.5"
                y="3.5"
                width="7"
                height="7"
                stroke="currentColor"
                strokeWidth="1.5"
                rx="0.5"
              />
            </svg>
          ) : (
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="2"
                y="2"
                width="8"
                height="8"
                stroke="currentColor"
                strokeWidth="1.5"
                rx="1"
              />
            </svg>
          )}
        </button>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="window-control-btn window-control-close"
          aria-label="Close"
          title="Close"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

// Menu Item Component
function MenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 12px",
        borderRadius: "4px",
        fontSize: "var(--font-size-sm)",
        color: "var(--text-primary)",
        background: "transparent",
        textAlign: "left",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--glass-bg-hover)"
        e.currentTarget.style.color = "var(--accent)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent"
        e.currentTarget.style.color = "var(--text-primary)"
      }}
    >
      {children}
    </button>
  )
}
