import { useEffect, useState, useCallback } from "react"

/* ══════════════════════════════════════════
   UPDATE CHECKER — Floating banner + modal
   Checks GitHub releases on app start.
   Also listens for manual "check-for-updates" event from Settings.
══════════════════════════════════════════ */

interface UpdateInfo {
  current_version: string
  latest_version: string
  release_name: string
  release_notes: string
  download_url: string
  installer_name: string
  installer_size: number
  release_url: string
  update_available: boolean
}

type UpdateState = "idle" | "checking" | "available" | "downloading" | "installing" | "error" | "up-to-date"

export default function UpdateChecker() {
  const [state, setState]       = useState<UpdateState>("idle")
  const [info, setInfo]         = useState<UpdateInfo | null>(null)
  const [error, setError]       = useState("")
  const [progress, setProgress] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [manualCheck, setManualCheck] = useState(false)

  /* ── Check for updates on mount (with a small delay) ── */
  useEffect(() => {
    const timer = setTimeout(() => checkForUpdate(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  /* ── Listen for manual "check-for-updates" event from Settings ── */
  useEffect(() => {
    const handler = () => {
      setDismissed(false)
      setManualCheck(true)
      checkForUpdate(true)
    }
    window.addEventListener("check-for-updates", handler)
    return () => window.removeEventListener("check-for-updates", handler)
  }, [])

  /* ── Listen for download progress events ── */
  useEffect(() => {
    window.electron.on("updater:progress", (data: any) => {
      if (data.percent) setProgress(Math.round(data.percent))
    })
  }, [])

  /* ── Auto-hide "up-to-date" toast after 4s ── */
  useEffect(() => {
    if (state === "up-to-date" && manualCheck) {
      const t = setTimeout(() => setManualCheck(false), 4000)
      return () => clearTimeout(t)
    }
  }, [state, manualCheck])

  const checkForUpdate = useCallback(async (manual: boolean) => {
    setState("checking")
    setError("")
    try {
      const result: UpdateInfo = await window.electron.invoke("updater:check")
      setInfo(result)
      if (result.update_available && result.download_url) {
        setState("available")
      } else {
        setState("up-to-date")
      }
    } catch (err: any) {
      setState("error")
      setError(String(err?.message || err))
    }
  }, [])

  const startUpdate = useCallback(async () => {
    if (!info) return
    setState("downloading")
    setProgress(0)
    try {
      await window.electron.invoke("updater:downloadAndInstall", {
        download_url: info.download_url,
        installer_name: info.installer_name,
      })
      setState("installing")
    } catch (err: any) {
      setState("error")
      setError(String(err?.message || err))
    }
  }, [info])

  const dismiss = () => {
    setDismissed(true)
    setShowModal(false)
    setManualCheck(false)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  /* ── Determine visibility ── */
  const showCheckingToast = state === "checking" && manualCheck
  const showUpToDateToast = state === "up-to-date" && manualCheck
  const showAvailableBanner = state === "available" && !showModal && !dismissed
  const showDownloading = state === "downloading" || state === "installing"
  const showError = state === "error" && !dismissed

  if (!showCheckingToast && !showUpToDateToast && !showAvailableBanner && !showDownloading && !showError && !showModal) {
    return null
  }

  return (
    <>
      {/* ── Checking toast (manual only) ── */}
      {showCheckingToast && (
        <div style={{
          position: "fixed", bottom: "16px", right: "16px", zIndex: 1500,
          display: "flex", alignItems: "center", gap: "10px",
          padding: "12px 16px", borderRadius: "var(--radius-lg)",
          background: "var(--bg-surface)",
          border: "1px solid var(--glass-border-strong)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
        }}>
          <div style={{
            width: "14px", height: "14px", borderRadius: "50%",
            border: "2px solid var(--glass-border-strong)",
            borderTopColor: "var(--accent)",
            animation: "spin 0.7s linear infinite",
            flexShrink: 0,
          }} />
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
            Checking for updates…
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── Up-to-date toast (manual only) ── */}
      {showUpToDateToast && (
        <div style={{
          position: "fixed", bottom: "16px", right: "16px", zIndex: 1500,
          display: "flex", alignItems: "center", gap: "10px",
          padding: "12px 16px", borderRadius: "var(--radius-lg)",
          background: "var(--bg-surface)",
          border: "1px solid rgba(52,211,153,0.25)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
        }}>
          <div style={{
            width: "20px", height: "20px", borderRadius: "50%", flexShrink: 0,
            background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4.2 7.2L8 3" stroke="var(--color-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
              You're up to date!
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "1px" }}>
              Version {info?.current_version ?? "—"} is the latest.
            </div>
          </div>
          <button onClick={() => setManualCheck(false)} style={{
            padding: "4px 8px", borderRadius: "var(--radius-sm)",
            fontSize: "10px", background: "var(--glass-bg)", color: "var(--text-tertiary)",
            border: "1px solid var(--glass-border)", cursor: "pointer", marginLeft: "6px",
          }}>✕</button>
        </div>
      )}

      {/* ── Floating banner (bottom-right) — only when update available ── */}
      {showAvailableBanner && (
        <div style={{
          position: "fixed", bottom: "16px", right: "16px", zIndex: 1500,
          display: "flex", alignItems: "center", gap: "12px",
          padding: "12px 16px", borderRadius: "var(--radius-lg)",
          background: "var(--bg-surface)",
          border: "1px solid var(--accent-border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
          maxWidth: "360px",
        }}>
          {/* Icon */}
          <div style={{
            width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0,
            background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
              Update Available
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "1px" }}>
              {info?.latest_version} · {info ? formatSize(info.installer_size) : ""}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
            <button onClick={() => setShowModal(true)} style={{
              padding: "6px 12px", borderRadius: "var(--radius-sm)",
              fontSize: "10px", fontWeight: 600,
              background: "linear-gradient(135deg, var(--glow-a), var(--glow-b))",
              color: "white", border: "1px solid var(--accent-border)",
              cursor: "pointer",
            }}>
              Update
            </button>
            <button onClick={dismiss} style={{
              padding: "6px 8px", borderRadius: "var(--radius-sm)",
              fontSize: "10px", fontWeight: 600,
              background: "var(--glass-bg)", color: "var(--text-tertiary)",
              border: "1px solid var(--glass-border)", cursor: "pointer",
            }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Downloading banner ── */}
      {showDownloading && (
        <div style={{
          position: "fixed", bottom: "16px", right: "16px", zIndex: 1500,
          padding: "14px 18px", borderRadius: "var(--radius-lg)",
          background: "var(--bg-surface)",
          border: "1px solid var(--accent-border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          width: "320px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <div style={{
              width: "14px", height: "14px", borderRadius: "50%",
              border: "2px solid var(--glass-border-strong)",
              borderTopColor: "var(--accent)",
              animation: "spin 0.7s linear infinite",
            }} />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
              {state === "downloading" ? "Downloading update…" : "Launching installer…"}
            </span>
          </div>
          {state === "downloading" && (
            <>
              <div style={{
                width: "100%", height: "4px", borderRadius: "2px",
                background: "var(--glass-border-strong)", overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", borderRadius: "2px",
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, var(--glow-a), var(--accent))",
                  transition: "width 0.3s ease",
                }} />
              </div>
              <div style={{
                fontSize: "10px", color: "var(--text-tertiary)", marginTop: "6px", textAlign: "right",
              }}>
                {progress}%
              </div>
            </>
          )}
          {state === "installing" && (
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
              The installer will open shortly. This app will close automatically.
            </div>
          )}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── Error banner ── */}
      {showError && (
        <div style={{
          position: "fixed", bottom: "16px", right: "16px", zIndex: 1500,
          display: "flex", alignItems: "center", gap: "10px",
          padding: "12px 16px", borderRadius: "var(--radius-lg)",
          background: "var(--bg-surface)",
          border: "1px solid rgba(248,113,113,0.3)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          maxWidth: "360px",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-red)" }}>
              Update check failed
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "2px" }}>
              {error || "Could not reach GitHub. Check your connection."}
            </div>
          </div>
          <button onClick={dismiss} style={{
            padding: "4px 8px", borderRadius: "var(--radius-sm)",
            fontSize: "10px", background: "var(--glass-bg)", color: "var(--text-tertiary)",
            border: "1px solid var(--glass-border)", cursor: "pointer",
          }}>✕</button>
        </div>
      )}

      {/* ══════ UPDATE MODAL ══════ */}
      {showModal && info && (
        <div
          onClick={() => { if (state === "available") setShowModal(false) }}
          style={{
            position: "fixed", inset: 0, zIndex: 2100,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "min(480px, calc(100vw - 48px))",
              maxHeight: "calc(100vh - 80px)",
              borderRadius: "var(--radius-xl)",
              background: "var(--modal-bg, rgba(12,15,30,0.97))",
              border: "1px solid var(--glass-border-strong)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}
          >
            {/* Modal header */}
            <div style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid var(--glass-border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "38px", height: "38px", borderRadius: "10px",
                  background: "linear-gradient(135deg, var(--glow-a), var(--glow-b))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px", color: "white",
                }}>⬆</div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Update Available
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "1px" }}>
                    {info.current_version} → {info.latest_version}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{
                width: "30px", height: "30px", borderRadius: "8px",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                color: "var(--text-secondary)", cursor: "pointer",
              }}>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              {/* Release info */}
              <div style={{
                padding: "14px 16px", borderRadius: "var(--radius-lg)",
                background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                marginBottom: "16px",
              }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                  {info.release_name}
                </div>
                {info.release_notes && (
                  <div style={{
                    fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.6,
                    maxHeight: "200px", overflowY: "auto",
                    whiteSpace: "pre-wrap",
                  }}>
                    {info.release_notes}
                  </div>
                )}
              </div>

              {/* Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                <DetailRow label="Current Version" value={info.current_version} />
                <DetailRow label="New Version" value={info.latest_version} accent />
                <DetailRow label="Installer" value={info.installer_name || "Not found"} />
                <DetailRow label="Size" value={info.installer_size > 0 ? formatSize(info.installer_size) : "Unknown"} />
              </div>

              {/* Info note */}
              <div style={{
                padding: "10px 14px", borderRadius: "var(--radius-md)",
                background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
                marginBottom: "16px",
              }}>
                <p style={{ fontSize: "10px", color: "var(--accent)", lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                  The installer will be downloaded and launched automatically.
                  This app will close so the installer can update it.
                  The installer will detect your existing installation path.
                </p>
              </div>
            </div>

            {/* Modal footer */}
            <div style={{
              padding: "16px 24px", borderTop: "1px solid var(--glass-border)",
              display: "flex", justifyContent: "flex-end", gap: "8px",
            }}>
              <button onClick={() => setShowModal(false)} style={{
                padding: "8px 18px", borderRadius: "var(--radius-md)",
                fontSize: "12px", fontWeight: 600,
                background: "var(--glass-bg)", color: "var(--text-secondary)",
                border: "1px solid var(--glass-border)", cursor: "pointer",
              }}>
                Later
              </button>
              <button
                onClick={startUpdate}
                disabled={!info.download_url}
                style={{
                  padding: "8px 22px", borderRadius: "var(--radius-md)",
                  fontSize: "12px", fontWeight: 600,
                  background: info.download_url
                    ? "linear-gradient(135deg, var(--glow-a), var(--glow-b))"
                    : "var(--glass-bg)",
                  color: info.download_url ? "white" : "var(--text-tertiary)",
                  border: "1px solid var(--accent-border)",
                  cursor: info.download_url ? "pointer" : "not-allowed",
                  opacity: info.download_url ? 1 : 0.5,
                }}
              >
                Download & Install
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 0",
    }}>
      <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{
        fontSize: "11px", fontWeight: 600,
        color: accent ? "var(--accent)" : "var(--text-primary)",
        fontFamily: "'JetBrains Mono', monospace",
      }}>{value}</span>
    </div>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
