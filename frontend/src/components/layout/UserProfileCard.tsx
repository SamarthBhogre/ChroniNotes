import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import {
  STATUS_CONFIG,
  useUserStore,
  type UserStatus,
} from "../../store/user.store"
import { useTimerStore } from "../../store/timer.store"

const STATUS_ORDER: UserStatus[] = ["working", "meeting", "dnd", "idle", "custom"]

function resizeImage(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = maxSize
        canvas.height = maxSize
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Could not create image canvas"))
          return
        }

        const cropSide = Math.min(img.width, img.height)
        const sx = (img.width - cropSide) / 2
        const sy = (img.height - cropSide) / 2
        ctx.drawImage(img, sx, sy, cropSide, cropSide, 0, 0, maxSize, maxSize)

        resolve(canvas.toDataURL("image/jpeg", 0.9))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

function Avatar({
  avatar,
  name,
  status,
  size,
  onClick,
}: {
  avatar: string | null
  name: string
  status: UserStatus
  size: number
  onClick?: () => void
}) {
  const cfg = STATUS_CONFIG[status]
  const initial = (name.trim()[0] || "U").toUpperCase()

  return (
    <span
      onClick={onClick}
      onKeyDown={e => {
        if (!onClick) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={onClick ? "Change photo" : undefined}
      style={{
        display: "block",
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        position: "relative",
        padding: 0,
        cursor: onClick ? "pointer" : "default",
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border-strong)",
      }}
    >
      {avatar ? (
        <img
          src={avatar}
          alt="Profile"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <span
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-primary)",
            background:
              "linear-gradient(135deg, var(--glass-bg-hover), var(--bg-surface))",
            fontSize: size >= 56 ? "22px" : "13px",
            fontWeight: 700,
          }}
        >
          {initial}
        </span>
      )}
      <span
        style={{
          position: "absolute",
          right: size >= 56 ? 2 : 0,
          bottom: size >= 56 ? 2 : 0,
          width: size >= 56 ? 13 : 10,
          height: size >= 56 ? 13 : 10,
          borderRadius: "50%",
          background: cfg.color,
          border: "2px solid var(--bg-surface)",
          boxShadow: `0 0 0 3px ${cfg.wash}`,
        }}
      />
    </span>
  )
}

function statusLabel(status: UserStatus, customStatus: string) {
  return status === "custom" ? customStatus : STATUS_CONFIG[status].label
}

function formatDuration(seconds: number) {
  if (seconds < 60) return "<1m"
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`
  return `${minutes}m`
}

function ActivitySummary({
  customStatus,
  activity,
}: {
  customStatus: string
  activity: Partial<Record<UserStatus, number>>
}) {
  const entries = STATUS_ORDER
    .map(status => ({ status, seconds: activity[status] ?? 0 }))
    .filter(item => item.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
  const total = entries.reduce((sum, item) => sum + item.seconds, 0)
  const top = entries.slice(0, 2)

  return (
    <div
      style={{
        marginTop: 14,
        padding: 12,
        borderRadius: 10,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--glass-border)",
      }}
    >
      <div
        style={{
          fontSize: "9px",
          fontWeight: 800,
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          marginBottom: 10,
        }}
      >
        Today's activity
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        {(top.length ? top : [{ status: "idle" as UserStatus, seconds: 0 }]).map(item => {
          const cfg = STATUS_CONFIG[item.status]
          return (
            <div
              key={item.status}
              style={{
                padding: "9px 10px",
                borderRadius: 8,
                background: "rgba(0,0,0,0.18)",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: item.seconds > 0 ? cfg.color : "var(--text-tertiary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {statusLabel(item.status, customStatus)}
              </div>
              <div style={{ marginTop: 4, color: "var(--text-primary)", fontSize: 18, fontWeight: 800 }}>
                {formatDuration(item.seconds)}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        {(entries.length ? entries : [{ status: "idle" as UserStatus, seconds: 0 }]).map(item => {
          const cfg = STATUS_CONFIG[item.status]
          const pct = total > 0 ? Math.max(5, (item.seconds / total) * 100) : 8
          return (
            <div key={item.status} style={{ display: "grid", gridTemplateColumns: "78px 1fr", gap: 8, alignItems: "center" }}>
              <span
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "10px",
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {statusLabel(item.status, customStatus)}
              </span>
              <span style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <span
                  style={{
                    display: "block",
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: cfg.color,
                  }}
                />
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function UserProfileCard({ collapsed = false }: { collapsed?: boolean }) {
  const { name, avatar, status, customStatus, setName, setAvatar, setStatus, setCustomStatus, getTodayActivity, hydrate } =
    useUserStore()
  const startTimer = useTimerStore(s => s.start)
  const setTimerTool = useTimerStore(s => s.setTool)
  const timerRunning = useTimerStore(s => s.isRunning)
  const timerTool = useTimerStore(s => s.tool)

  const fileRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const [showProfilePopup, setShowProfilePopup] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [draftCustomStatus, setDraftCustomStatus] = useState(customStatus)
  const [activityTick, setActivityTick] = useState(0)
  const [popupRect, setPopupRect] = useState({ left: 12, bottom: 82, width: 288 })

  useEffect(() => { hydrate() }, [])
  useEffect(() => { setDraftName(name) }, [name])
  useEffect(() => { setDraftCustomStatus(customStatus) }, [customStatus])
  useEffect(() => {
    if (!showProfilePopup) return
    const timer = setInterval(() => setActivityTick(t => t + 1), 30000)
    return () => clearInterval(timer)
  }, [showProfilePopup])
  useEffect(() => {
    if (!showProfilePopup) return

    const updatePopupRect = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return

      const targetWidth = collapsed
        ? 288
        : Math.min(340, Math.max(288, rect.width))
      const preferredLeft = collapsed ? rect.right + 10 : rect.left
      const maxLeft = Math.max(12, window.innerWidth - targetWidth - 12)

      setPopupRect({
        left: Math.min(Math.max(12, preferredLeft), maxLeft),
        bottom: Math.max(12, window.innerHeight - rect.top + 8),
        width: targetWidth,
      })
    }

    updatePopupRect()
    window.addEventListener("resize", updatePopupRect)
    window.addEventListener("scroll", updatePopupRect, true)
    return () => {
      window.removeEventListener("resize", updatePopupRect)
      window.removeEventListener("scroll", updatePopupRect, true)
    }
  }, [collapsed, showProfilePopup])

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !file.type.startsWith("image/")) return

      try {
        setAvatar(await resizeImage(file))
      } catch {
        console.error("Failed to process avatar image")
      } finally {
        e.target.value = ""
      }
    },
    [setAvatar]
  )

  const commitName = () => {
    setName(draftName)
    setEditing(false)
  }

  const cfg = STATUS_CONFIG[status]
  const activeStatusLabel = statusLabel(status, customStatus)
  const activity = getTodayActivity()
  void activityTick

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <button
        ref={buttonRef}
        onClick={() => setShowProfilePopup(v => !v)}
        style={{
          margin: collapsed ? "8px auto 12px" : "10px 10px 14px",
          width: collapsed ? 42 : "calc(100% - 20px)",
          minHeight: collapsed ? 42 : 58,
          padding: collapsed ? 0 : "10px 12px",
          borderRadius: "10px",
          background: showProfilePopup ? "var(--glass-bg-hover)" : "rgba(255,255,255,0.025)",
          border: `1px solid ${showProfilePopup ? "var(--accent-border)" : "var(--glass-border)"}`,
          color: "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 10,
          flexShrink: 0,
          textAlign: "left",
          transition: "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
          boxShadow: showProfilePopup ? "0 0 18px rgba(0,0,0,0.22)" : "none",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "var(--glass-bg-hover)"
          e.currentTarget.style.borderColor = "var(--glass-border-strong)"
        }}
        onMouseLeave={e => {
          if (!showProfilePopup) {
            e.currentTarget.style.background = "rgba(255,255,255,0.025)"
            e.currentTarget.style.borderColor = "var(--glass-border)"
          }
        }}
      >
        <Avatar avatar={avatar} name={name} status={status} size={collapsed ? 32 : 34} />

        {!collapsed && (
          <>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  marginTop: 4,
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: cfg.wash,
                  border: `1px solid ${cfg.border}`,
                  color: cfg.color,
                  fontSize: "9.5px",
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: cfg.color,
                  }}
                />
                {activeStatusLabel}
              </span>
            </span>

            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{
                color: "var(--text-tertiary)",
                flexShrink: 0,
                transform: showProfilePopup ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease",
              }}
            >
              <path
                d="M3 4.5L6 7.5L9 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </>
        )}
      </button>

      {showProfilePopup && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 998 }}
            onClick={() => {
              setShowProfilePopup(false)
              if (editing) commitName()
            }}
          />

          <div
            style={{
              position: "fixed",
              bottom: popupRect.bottom,
              left: popupRect.left,
              width: popupRect.width,
              maxWidth: "calc(100vw - 24px)",
              maxHeight: "calc(100vh - 24px)",
              overflowY: "auto",
              zIndex: 999,
              borderRadius: "12px",
              padding: 14,
              background: "var(--bg-surface)",
              border: "1px solid var(--glass-border-strong)",
              boxShadow:
                "0 18px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03)",
              animation: "profilePopupIn 0.16s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <Avatar
                avatar={avatar}
                name={name}
                status={status}
                size={58}
                onClick={() => fileRef.current?.click()}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    letterSpacing: "0.6px",
                    textTransform: "uppercase",
                    color: "var(--text-tertiary)",
                    marginBottom: 5,
                  }}
                >
                  Profile
                </div>

                {editing ? (
                  <input
                    ref={nameRef}
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") commitName()
                      if (e.key === "Escape") {
                        setDraftName(name)
                        setEditing(false)
                      }
                    }}
                    onBlur={commitName}
                    maxLength={24}
                    style={{
                      width: "100%",
                      padding: "7px 9px",
                      fontSize: "12px",
                      fontWeight: 600,
                      borderRadius: "8px",
                      background: "var(--glass-bg)",
                      border: "1px solid var(--accent-border)",
                      color: "var(--text-primary)",
                      outline: "none",
                    }}
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditing(true)
                      setTimeout(() => nameRef.current?.focus(), 40)
                    }}
                    style={{
                      display: "block",
                      maxWidth: "100%",
                      padding: 0,
                      color: "var(--text-primary)",
                      fontSize: "15px",
                      fontWeight: 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </button>
                )}

                <div style={{ marginTop: 7, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{
                      flex: "1 1 92px",
                      padding: "5px 8px",
                      borderRadius: "7px",
                      background: "var(--glass-bg)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-secondary)",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    Change photo
                  </button>
                  {avatar && (
                    <button
                      onClick={() => setAvatar(null)}
                      style={{
                        flex: "1 1 74px",
                        padding: "5px 8px",
                        borderRadius: "7px",
                        background: "rgba(248,113,113,0.08)",
                        border: "1px solid rgba(248,113,113,0.18)",
                        color: "var(--color-red)",
                        fontSize: "10px",
                        fontWeight: 700,
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: "var(--glass-border)", margin: "14px 0" }} />

            <div
              style={{
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.6px",
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
                marginBottom: 8,
              }}
            >
              Status
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              {STATUS_ORDER.map((key) => {
                const val = STATUS_CONFIG[key]
                const active = status === key
                return (
                  <button
                    key={key}
                    onClick={() => setStatus(key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "9px",
                      background: active ? val.wash : "transparent",
                      border: `1px solid ${active ? val.border : "var(--glass-border)"}`,
                      color: active ? val.color : "var(--text-secondary)",
                      fontSize: "12px",
                      fontWeight: active ? 700 : 600,
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: val.color,
                        boxShadow: active ? `0 0 0 3px ${val.wash}` : "none",
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>{statusLabel(key, customStatus)}</span>
                    {active && (
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M3.5 7L6 9.5L10.5 4.5"
                          stroke={val.color}
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

            <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
              <input
                value={draftCustomStatus}
                onChange={e => setDraftCustomStatus(e.target.value)}
                onBlur={() => setCustomStatus(draftCustomStatus)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    setCustomStatus(draftCustomStatus)
                    setStatus("custom")
                    e.currentTarget.blur()
                  }
                }}
                maxLength={32}
                placeholder="Custom status"
                style={{
                  minWidth: 0,
                  flex: 1,
                  padding: "7px 9px",
                  borderRadius: 8,
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                  fontSize: 11,
                  fontWeight: 600,
                  outline: "none",
                }}
              />
              <button
                onClick={() => {
                  setCustomStatus(draftCustomStatus)
                  setStatus("custom")
                }}
                style={{
                  padding: "7px 9px",
                  borderRadius: 8,
                  background: STATUS_CONFIG.custom.wash,
                  border: `1px solid ${STATUS_CONFIG.custom.border}`,
                  color: STATUS_CONFIG.custom.color,
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                Set
              </button>
            </div>

            <button
              onClick={async () => {
                setStatus("working")
                if (!timerRunning || timerTool !== "pomodoro") {
                  setTimerTool("pomodoro")
                  await startTimer()
                }
              }}
              style={{
                width: "100%",
                marginTop: 10,
                padding: "8px 10px",
                borderRadius: 9,
                background: STATUS_CONFIG.working.wash,
                border: `1px solid ${STATUS_CONFIG.working.border}`,
                color: STATUS_CONFIG.working.color,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {timerRunning && timerTool === "pomodoro" ? "Focus timer running" : "Start Working focus timer"}
            </button>

            <ActivitySummary customStatus={customStatus} activity={activity} />
          </div>
        </>
      )}

      <style>{`
        @keyframes profilePopupIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}
