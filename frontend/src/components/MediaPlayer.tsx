import { useEffect, useRef, useState } from "react"
import { useMediaStore, type MediaInfo } from "../store/media.store"

const MusicIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
)

const PlayIcon = (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
)

const PauseIcon = (
  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
)

const PrevIcon = (
  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
  </svg>
)

const NextIcon = (
  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 18l8.5-6L6 6v12zm8.5-6v6h2V6h-2v6z" />
  </svg>
)

const RefreshIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
)

function sourceLabel(sourceApp: string): string {
  const cleaned = sourceApp
    .replace(/!App$/i, "")
    .replace(/\.exe$/i, "")
    .replace(/_/g, " ")

  if (cleaned.toLowerCase().includes("spotify")) return "Spotify"
  if (cleaned.toLowerCase().includes("chrome")) return "Chrome"
  if (cleaned.toLowerCase().includes("msedge")) return "Microsoft Edge"
  if (cleaned.toLowerCase().includes("vlc")) return "VLC"
  return cleaned || "Media"
}

export default function MediaPlayer() {
  const {
    current, sessions, loading, error,
    fetchCurrent, fetchSessions, playPause, next, previous, clearError,
  } = useMediaStore()
  const [collapsed, setCollapsed] = useState(false)
  const [showSessions, setShowSessions] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    void fetchCurrent()
    void fetchSessions()
    pollRef.current = setInterval(() => {
      void fetchCurrent()
      if (showSessions) void fetchSessions()
    }, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchCurrent, fetchSessions, showSessions])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(clearError, 5000)
    return () => clearTimeout(t)
  }, [error, clearError])

  const refresh = () => {
    void fetchCurrent()
    void fetchSessions()
  }

  return (
    <div style={{
      borderTop: "1px solid var(--glass-border)",
      background: "rgba(0,0,0,0.15)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px 4px",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          color: "var(--accent)", fontSize: "10px", fontWeight: 700,
          minWidth: 0,
        }}>
          {MusicIcon}
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Media Session
          </span>
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          <MiniBtn onClick={() => setShowSessions(!showSessions)} title="All sessions" active={showSessions}>
            <span style={{ fontSize: "11px", lineHeight: 1 }}>{sessions.length || 0}</span>
          </MiniBtn>
          <MiniBtn onClick={refresh} title="Refresh">
            {RefreshIcon}
          </MiniBtn>
          <MiniBtn onClick={() => setCollapsed(!collapsed)} title={collapsed ? "Expand" : "Collapse"}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
              {collapsed ? <polyline points="2,4 5,7 8,4" /> : <polyline points="2,7 5,4 8,7" />}
            </svg>
          </MiniBtn>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: "4px 12px 10px" }}>
          {current ? <TrackInfo media={current} /> : (
            <div style={{
              fontSize: "11px", color: "var(--text-tertiary)",
              textAlign: "center", padding: "10px 0",
            }}>
              {loading ? "Checking media..." : "No media playing"}
            </div>
          )}

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "8px", marginTop: current ? "10px" : "2px",
          }}>
            <ControlBtn onClick={() => void previous()} title="Previous" disabled={!current}>
              {PrevIcon}
            </ControlBtn>
            <ControlBtn onClick={() => void playPause()} title={current?.is_playing ? "Pause" : "Play"} primary disabled={!current}>
              {current?.is_playing ? PauseIcon : PlayIcon}
            </ControlBtn>
            <ControlBtn onClick={() => void next()} title="Next" disabled={!current}>
              {NextIcon}
            </ControlBtn>
          </div>

          {showSessions && (
            <div style={{ marginTop: "10px" }}>
              <div style={{
                fontSize: "9px", fontWeight: 700, letterSpacing: "0.5px",
                textTransform: "uppercase", color: "var(--text-tertiary)",
                marginBottom: "6px",
              }}>
                Sessions
              </div>
              {sessions.length === 0 ? (
                <div style={{
                  fontSize: "10px", color: "var(--text-tertiary)",
                  textAlign: "center", padding: "8px 0",
                }}>
                  No active sessions
                </div>
              ) : (
                <div style={{
                  maxHeight: "150px", overflowY: "auto",
                  display: "flex", flexDirection: "column", gap: "4px",
                }}>
                  {sessions.map((session, index) => (
                    <SessionRow key={`${session.source_app}-${session.title}-${index}`} media={session} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{
          margin: "0 12px 8px", padding: "6px 10px",
          borderRadius: "var(--radius-sm)",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.2)",
          fontSize: "10px", color: "var(--color-red)",
          lineHeight: 1.4,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

function TrackInfo({ media }: { media: MediaInfo }) {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
      {media.thumbnail ? (
        <img
          src={media.thumbnail}
          alt=""
          style={{
            width: "44px", height: "44px", borderRadius: "6px",
            objectFit: "cover", flexShrink: 0,
            border: "1px solid var(--glass-border)",
          }}
        />
      ) : (
        <div style={{
          width: "44px", height: "44px", borderRadius: "6px",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, color: "var(--accent)",
          background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
        }}>
          {MusicIcon}
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: "12px", fontWeight: 700,
          color: "var(--text-primary)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {media.title}
        </div>
        <div style={{
          fontSize: "10px", color: "var(--text-tertiary)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          marginTop: "2px",
        }}>
          {media.artist || "Unknown artist"}
        </div>
        <div style={{
          fontSize: "9px", color: media.is_playing ? "var(--accent)" : "var(--text-tertiary)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          marginTop: "2px", fontWeight: 600,
        }}>
          {media.is_playing ? "Playing" : "Paused"} - {sourceLabel(media.source_app)}
        </div>
      </div>
    </div>
  )
}

function SessionRow({ media }: { media: MediaInfo }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "8px",
      padding: "6px", borderRadius: "6px",
      background: "var(--glass-bg)",
      border: "1px solid var(--glass-border)",
    }}>
      <div style={{
        width: "8px", height: "8px", borderRadius: "50%",
        background: media.is_playing ? "var(--accent)" : "var(--text-tertiary)",
        boxShadow: media.is_playing ? "0 0 6px var(--accent-glow)" : "none",
        flexShrink: 0,
      }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: "10px", fontWeight: 600, color: "var(--text-secondary)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {media.title}
        </div>
        <div style={{
          fontSize: "9px", color: "var(--text-tertiary)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {sourceLabel(media.source_app)}
        </div>
      </div>
    </div>
  )
}

function MiniBtn({ onClick, title, children, active }: {
  onClick: () => void
  title: string
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: "20px", height: "20px", borderRadius: "4px",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? "var(--accent-dim)" : "transparent",
        border: "none",
        color: active ? "var(--accent)" : "var(--text-tertiary)",
        cursor: "pointer",
        transition: "all 0.15s ease", padding: 0,
      }}
    >
      {children}
    </button>
  )
}

function ControlBtn({ onClick, title, children, primary, disabled }: {
  onClick: () => void
  title: string
  children: React.ReactNode
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: primary ? "34px" : "28px",
        height: primary ? "34px" : "28px",
        borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: primary ? "var(--accent)" : "var(--glass-bg)",
        border: `1px solid ${primary ? "var(--accent)" : "var(--glass-border)"}`,
        color: primary ? "white" : "var(--text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s ease", padding: 0,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  )
}
