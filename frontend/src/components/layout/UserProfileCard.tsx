import { useRef, useState, useEffect, useCallback } from "react"
import {
  useUserStore,
  STATUS_CONFIG,
  type UserStatus,
} from "../../store/user.store"

/* ── Resize an image file to a square, "cover" style (no distortion) ── */
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
        const ctx = canvas.getContext("2d")!

        // "cover" — crop the shortest side, center the longer side
        const cropSide = Math.min(img.width, img.height)
        const sx = (img.width - cropSide) / 2
        const sy = (img.height - cropSide) / 2

        // Draw the center-cropped square scaled into the canvas
        ctx.drawImage(img, sx, sy, cropSide, cropSide, 0, 0, maxSize, maxSize)

        resolve(canvas.toDataURL("image/jpeg", 0.9))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export default function UserProfileCard() {
  const { name, avatar, status, setName, setAvatar, setStatus, hydrate } =
    useUserStore()

  const fileRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showProfilePopup, setShowProfilePopup] = useState(false)
  const [draftName, setDraftName] = useState(name)

  // Hydrate from localStorage on mount
  useEffect(() => { hydrate() }, [])
  // Sync draft when store changes
  useEffect(() => { setDraftName(name) }, [name])

  /* ── Avatar picker ── */
  const handleAvatarClick = () => fileRef.current?.click()

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!file.type.startsWith("image/")) return
      try {
        const dataUrl = await resizeImage(file)
        setAvatar(dataUrl)
      } catch {
        console.error("Failed to process avatar image")
      }
      e.target.value = "" // reset so same file can be re-selected
    },
    [setAvatar]
  )

  /* ── Name editing ── */
  const startEditing = () => {
    setEditing(true)
    setTimeout(() => nameRef.current?.focus(), 50)
  }
  const commitName = () => {
    setName(draftName)
    setEditing(false)
  }

  const cfg = STATUS_CONFIG[status]

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* ── Card ── */}
      <div
        className="px-4 py-4 mx-3 mb-4 rounded-xl flex items-center gap-3"
        style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          marginTop: "auto",
          transition:
            "background 0.2s ease, border-color 0.2s ease, transform 0.2s ease",
          cursor: "pointer",
          position: "relative",
        }}
        onClick={() => setShowProfilePopup((v) => !v)}
        onMouseEnter={(e) => {
          const el = e.currentTarget
          el.style.background = "var(--glass-bg-hover)"
          el.style.borderColor = "var(--glass-border-strong)"
          el.style.transform = "translateY(-1px)"
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget
          el.style.background = "var(--glass-bg)"
          el.style.borderColor = "var(--glass-border)"
          el.style.transform = "translateY(0)"
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            flexShrink: 0,
            position: "relative",
            overflow: "visible",
          }}
        >
          {avatar ? (
            <img
              src={avatar}
              alt="avatar"
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                objectFit: "cover",
                border: `2px solid ${cfg.color}`,
                boxShadow: cfg.glow,
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, var(--glow-b), var(--glow-c))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                fontWeight: 700,
                color: "white",
                border: `2px solid ${cfg.color}`,
                boxShadow: cfg.glow,
              }}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Status dot overlay */}
          <span
            style={{
              position: "absolute",
              bottom: "-1px",
              right: "-1px",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: cfg.color,
              border: "2px solid var(--bg-surface)",
              boxShadow: cfg.glow,
              animation: "pulse-glow 2s ease-in-out infinite",
            }}
          />
        </div>

        {/* Name + Status text */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            className="font-semibold truncate"
            style={{ fontSize: "12px", color: "var(--text-primary)" }}
          >
            {name}
          </div>
          <div
            className="flex items-center gap-1"
            style={{ fontSize: "10px", color: cfg.color }}
          >
            {cfg.label}
          </div>
        </div>

        {/* Chevron */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            color: "var(--text-tertiary)",
            flexShrink: 0,
            transform: showProfilePopup ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
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
      </div>

      {/* ── Profile popup ── */}
      {showProfilePopup && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 998 }}
            onClick={() => {
              setShowProfilePopup(false)
              setShowStatusMenu(false)
              if (editing) commitName()
            }}
          />

          <div
            style={{
              position: "absolute",
              bottom: "76px",
              left: "12px",
              right: "12px",
              zIndex: 999,
              borderRadius: "var(--radius-lg)",
              padding: "16px",
              background: "rgba(16, 19, 36, 0.97)",
              border: "1px solid var(--glass-border-strong)",
              backdropFilter: "blur(24px) saturate(160%)",
              WebkitBackdropFilter: "blur(24px) saturate(160%)",
              boxShadow:
                "0 -12px 40px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255,255,255,0.08)",
              animation: "profilePopupIn 0.2s ease",
            }}
          >
            {/* ── Avatar section ── */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              {/* Large avatar */}
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  handleAvatarClick()
                }}
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  position: "relative",
                  cursor: "pointer",
                  transition: "transform 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.05)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)"
                }}
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt="avatar"
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: `2px solid ${cfg.color}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      background:
                        "linear-gradient(135deg, var(--glow-b), var(--glow-c))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                      fontWeight: 700,
                      color: "white",
                      border: `2px solid ${cfg.color}`,
                    }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Camera overlay on hover */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0,
                    transition: "opacity 0.15s ease",
                    fontSize: "18px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "0"
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>

                {/* Status dot */}
                <span
                  style={{
                    position: "absolute",
                    bottom: "0px",
                    right: "0px",
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    background: cfg.color,
                    border: "2.5px solid rgba(16, 19, 36, 0.97)",
                    boxShadow: cfg.glow,
                  }}
                />
              </div>

              {/* Remove avatar button */}
              {avatar && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setAvatar(null)
                  }}
                  style={{
                    fontSize: "10px",
                    color: "var(--text-tertiary)",
                    padding: "2px 8px",
                    borderRadius: "8px",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--color-red)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-tertiary)"
                  }}
                >
                  Remove photo
                </button>
              )}
            </div>

            {/* ── Name field ── */}
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  fontSize: "9.5px",
                  fontWeight: 600,
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "6px",
                }}
              >
                Display Name
              </div>
              {editing ? (
                <input
                  ref={nameRef}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitName()
                    if (e.key === "Escape") {
                      setDraftName(name)
                      setEditing(false)
                    }
                  }}
                  onBlur={commitName}
                  onClick={(e) => e.stopPropagation()}
                  maxLength={24}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    fontSize: "12.5px",
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid var(--accent-border)",
                    color: "var(--text-primary)",
                    outline: "none",
                    boxShadow: "0 0 0 3px var(--accent-glow)",
                  }}
                />
              ) : (
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    startEditing()
                  }}
                  style={{
                    padding: "7px 10px",
                    fontSize: "12.5px",
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                    cursor: "text",
                    transition: "border-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor =
                      "var(--glass-border-strong)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--glass-border)"
                  }}
                >
                  {name}
                </div>
              )}
            </div>

            {/* ── Divider ── */}
            <div
              style={{
                height: "1px",
                background: "var(--glass-border)",
                margin: "12px 0",
              }}
            />

            {/* ── Status selector ── */}
            <div>
              <div
                style={{
                  fontSize: "9.5px",
                  fontWeight: 600,
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: "8px",
                }}
              >
                Status
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                }}
              >
                {(
                  Object.entries(STATUS_CONFIG) as [
                    UserStatus,
                    (typeof STATUS_CONFIG)[UserStatus],
                  ][]
                ).map(([key, val]) => {
                  const isActive = status === key
                  return (
                    <button
                      key={key}
                      onClick={(e) => {
                        e.stopPropagation()
                        setStatus(key)
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "12px",
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? val.color : "var(--text-secondary)",
                        background: isActive
                          ? `${val.color}15`
                          : "transparent",
                        border: `1px solid ${isActive ? `${val.color}30` : "transparent"}`,
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background =
                            "var(--glass-bg-hover)"
                          e.currentTarget.style.color = "var(--text-primary)"
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "transparent"
                          e.currentTarget.style.color = "var(--text-secondary)"
                        }
                      }}
                    >
                      {/* Status dot */}
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: val.color,
                          boxShadow: isActive ? val.glow : "none",
                          flexShrink: 0,
                          animation: isActive
                            ? "pulse-glow 2s ease-in-out infinite"
                            : "none",
                        }}
                      />
                      {val.label}

                      {/* Checkmark */}
                      {isActive && (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          style={{ marginLeft: "auto" }}
                        >
                          <path
                            d="M3.5 7L6 9.5L10.5 4.5"
                            stroke={val.color}
                            strokeWidth="1.5"
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
          </div>
        </>
      )}

      {/* ── Scoped keyframes ── */}
      <style>{`
        @keyframes profilePopupIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  )
}
