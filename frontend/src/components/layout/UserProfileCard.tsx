import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import {
  STATUS_CONFIG,
  useUserStore,
  type UserStatus,
} from "../../store/user.store"

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

export default function UserProfileCard({ collapsed = false }: { collapsed?: boolean }) {
  const { name, avatar, status, setName, setAvatar, setStatus, hydrate } =
    useUserStore()

  const fileRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const [showProfilePopup, setShowProfilePopup] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(name)

  useEffect(() => { hydrate() }, [])
  useEffect(() => { setDraftName(name) }, [name])

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
        onClick={() => setShowProfilePopup(v => !v)}
        style={{
          margin: collapsed ? "8px auto 12px" : "10px 12px 14px",
          width: collapsed ? 42 : "calc(100% - 24px)",
          minHeight: collapsed ? 42 : 58,
          padding: collapsed ? 0 : "10px 12px",
          borderRadius: "10px",
          background: showProfilePopup ? "var(--glass-bg-hover)" : "var(--bg-surface)",
          border: `1px solid ${showProfilePopup ? "var(--glass-border-strong)" : "var(--glass-border)"}`,
          color: "var(--text-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 10,
          flexShrink: 0,
          textAlign: "left",
          transition: "background 0.15s ease, border-color 0.15s ease",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "var(--glass-bg-hover)"
          e.currentTarget.style.borderColor = "var(--glass-border-strong)"
        }}
        onMouseLeave={e => {
          if (!showProfilePopup) {
            e.currentTarget.style.background = "var(--bg-surface)"
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
                {cfg.label}
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
              position: "absolute",
              bottom: collapsed ? "12px" : "82px",
              left: collapsed ? "66px" : "12px",
              right: collapsed ? "auto" : "12px",
              width: collapsed ? 272 : "auto",
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
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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

                <div style={{ marginTop: 7, display: "flex", gap: 6 }}>
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{
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
              {(
                Object.entries(STATUS_CONFIG) as [
                  UserStatus,
                  (typeof STATUS_CONFIG)[UserStatus],
                ][]
              ).map(([key, val]) => {
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
                    <span style={{ flex: 1 }}>{val.label}</span>
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
