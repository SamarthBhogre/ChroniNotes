import { useEffect, useState, useRef } from "react"
import { useTimerStore } from "../store/timer.store"

/* ── SVG ring progress arc ── */
function RingProgress({
  progress, isRunning, isBreak, isPaused,
}: {
  progress: number
  isRunning: boolean
  isBreak: boolean
  isPaused: boolean
}) {
  const size   = 220
  const stroke = 3
  const r      = (size - stroke * 2) / 2
  const circ   = 2 * Math.PI * r
  const offset = circ * (1 - Math.max(0, Math.min(1, progress)))

  const color = isPaused
    ? "rgba(129,140,248,0.4)"
    : isBreak
    ? "rgba(52,211,153,0.9)"
    : "rgba(129,140,248,0.9)"

  return (
    <svg
      width={size} height={size}
      style={{
        position: "absolute", inset: 0,
        transform: "rotate(-90deg)",
        transition: "opacity 0.4s ease",
        opacity: isRunning || isPaused ? 1 : 0.2,
      }}
    >
      <defs>
        <filter id="ringGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Track */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={stroke}
      />

      {/* Progress arc */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        filter="url(#ringGlow)"
        style={{
          transition: "stroke-dashoffset 1.05s cubic-bezier(0.4,0,0.2,1), stroke 0.6s ease",
        }}
      />
    </svg>
  )
}

/* ── Animated digit — flips when value changes ── */
function AnimDigit({ value }: { value: string }) {
  const prev  = useRef(value)
  const [flip, setFlip] = useState(false)

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value
      setFlip(true)
      const t = setTimeout(() => setFlip(false), 260)
      return () => clearTimeout(t)
    }
  }, [value])

  return (
    <span
      style={{
        display: "inline-block",
        transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease",
        transform: flip ? "translateY(-4px) scale(1.08)" : "translateY(0) scale(1)",
        opacity:   flip ? 0.6 : 1,
      }}
    >
      {value}
    </span>
  )
}

function AnimTimer({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0")
  const s = (seconds % 60).toString().padStart(2, "0")
  return (
    <>
      <AnimDigit value={m[0]} />
      <AnimDigit value={m[1]} />
      <span style={{ opacity: 0.5, margin: "0 3px", fontWeight: 300 }}>:</span>
      <AnimDigit value={s[0]} />
      <AnimDigit value={s[1]} />
    </>
  )
}

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function Timer() {
  const {
    tool, setTool,
    seconds, isRunning, isPaused, mode,
    workMinutes, breakMinutes,
    start, pause, stop,
    loadSettings, updateSettings, updateFromMain,
  } = useTimerStore()

  const [workInput,  setWorkInput]  = useState(workMinutes)
  const [breakInput, setBreakInput] = useState(breakMinutes)

  useEffect(() => { loadSettings() }, [])
  useEffect(() => {
    setWorkInput(workMinutes)
    setBreakInput(breakMinutes)
  }, [workMinutes, breakMinutes])
  useEffect(() => {
    window.electron.on("timer:update", updateFromMain)
  }, [])

  const isBreak = tool === "pomodoro" && isRunning && mode === "break"

  const statusText = isRunning
    ? tool === "pomodoro"
      ? mode === "work" ? "🧠 Focus session active" : "☕ Break time!"
      : "⏱ Stopwatch running"
    : isPaused ? "⏸ Paused"
    : "Ready to start"

  /* Progress 0→1 for ring arc */
  const totalSeconds = tool === "pomodoro"
    ? (mode === "work" ? workMinutes : breakMinutes) * 60
    : 0
  const progress = tool === "pomodoro" && totalSeconds > 0
    ? seconds / totalSeconds
    : 1   // stopwatch: keep arc full

  return (
    <div className="h-full" style={{ color: "var(--text-primary)" }}>
      <div style={{ maxWidth: "580px", margin: "0 auto", padding: "56px 32px 40px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: "36px" }}>
          <div
            className="inline-flex items-center gap-2 mb-4"
            style={{
              padding: "3px 10px", borderRadius: "20px",
              background: "var(--accent-dim)",
              border: "1px solid var(--accent-border)",
              fontSize: "10.5px", fontWeight: 600,
              color: "var(--accent)", letterSpacing: "0.3px",
            }}
          >
            ⊹ Timer
          </div>

          <h1 style={{
            fontSize: "2.4rem", fontWeight: 700,
            letterSpacing: "-0.5px", lineHeight: 1.15, marginBottom: "8px",
            background: "linear-gradient(135deg, var(--text-primary) 40%, var(--accent))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Timer
          </h1>
          <p style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}>
            Stay focused with Pomodoro or track time with Stopwatch
          </p>
        </div>

        {/* ── Main Glass Card ── */}
        <div className="glass" style={{
          borderRadius: "var(--radius-xl)", padding: "32px 28px",
          position: "relative", overflow: "hidden",
        }}>
          {/* Ambient glow */}
          <div style={{
            position: "absolute", top: "-60px", left: "50%",
            transform: "translateX(-50%)",
            width: "300px", height: "300px", borderRadius: "50%",
            background: isBreak ? "var(--glow-c)" : isRunning ? "var(--glow-a)" : "var(--glow-b)",
            opacity: isRunning ? 0.08 : 0.04,
            filter: "blur(60px)", pointerEvents: "none",
            transition: "opacity 1s ease, background 1.5s ease",
          }} />

          {/* ── Mode Toggle ── */}
          <div className="flex mx-auto" style={{
            width: "fit-content", padding: "4px",
            borderRadius: "var(--radius-lg)",
            background: "rgba(0,0,0,0.25)",
            border: "1px solid var(--glass-border)",
            marginBottom: "36px",
          }}>
            {(["pomodoro", "stopwatch"] as const).map(t => (
              <button key={t} onClick={() => setTool(t)} style={{
                padding: "7px 22px",
                borderRadius: "var(--radius-md)",
                fontSize: "12.5px", fontWeight: 600,
                color: tool === t ? "var(--text-primary)" : "var(--text-tertiary)",
                background: tool === t ? "var(--glass-bg-hover)" : "transparent",
                border: `1px solid ${tool === t ? "var(--glass-border-strong)" : "transparent"}`,
                boxShadow: tool === t ? "var(--glass-shadow)" : "none",
                transition: "all 0.2s ease",
              }}>
                {t === "pomodoro" ? "Pomodoro" : "Stopwatch"}
              </button>
            ))}
          </div>

          {/* ── Timer Ring Display ── */}
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center", justifyContent: "center",
              width: "220px", height: "220px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.25)",
              border: `1.5px solid ${
                isRunning
                  ? isBreak ? "rgba(52,211,153,0.25)" : "rgba(129,140,248,0.25)"
                  : "var(--glass-border)"
              }`,
              boxShadow: isRunning
                ? isBreak
                  ? "0 0 48px rgba(52,211,153,0.15), inset 0 0 30px rgba(52,211,153,0.03)"
                  : "0 0 48px var(--accent-glow), inset 0 0 30px rgba(99,102,241,0.03)"
                : "none",
              transition: "border-color 0.6s ease, box-shadow 0.6s ease",
              marginBottom: "20px",
              position: "relative",
            }}>

              {/* ✅ SVG progress arc */}
              <RingProgress
                progress={progress}
                isRunning={isRunning}
                isBreak={isBreak}
                isPaused={isPaused}
              />

              {/* Inner ring */}
              <div style={{
                position: "absolute", inset: "14px", borderRadius: "50%",
                border: `1px solid ${
                  isRunning
                    ? isBreak ? "rgba(52,211,153,0.15)" : "rgba(129,140,248,0.15)"
                    : "var(--glass-border)"
                }`,
                transition: "border-color 0.6s ease",
              }} />

              {/* ✅ Animated digits */}
              <span style={{
                fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
                fontSize: "3rem", fontWeight: 700,
                letterSpacing: "-2px",
                fontVariantNumeric: "tabular-nums",
                color: isRunning
                  ? isBreak ? "var(--color-green)" : "var(--text-primary)"
                  : isPaused ? "var(--accent)"
                  : "var(--text-secondary)",
                transition: "color 0.4s ease",
                position: "relative", zIndex: 1,
                display: "inline-flex", alignItems: "center",
              }}>
                <AnimTimer seconds={seconds} />
              </span>
            </div>

            {/* Status text */}
            <div className="flex items-center justify-center gap-2">
              {(isRunning || isPaused) && (
                <span style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: isPaused
                    ? "var(--accent)"
                    : isBreak ? "var(--color-green)" : "var(--accent)",
                  boxShadow: `0 0 6px ${isPaused ? "var(--accent)" : isBreak ? "var(--color-green)" : "var(--accent)"}`,
                  display: "inline-block",
                  animation: isRunning ? "pulse-glow 2s ease-in-out infinite" : "none",
                }} />
              )}
              <span style={{
                fontSize: "12px", fontWeight: 500,
                color: isRunning
                  ? isBreak ? "var(--color-green)" : "var(--accent)"
                  : isPaused ? "var(--accent)"
                  : "var(--text-tertiary)",
                transition: "color 0.4s ease",
              }}>
                {statusText}
              </span>
            </div>
          </div>

          {/* ── Controls ── */}
          <div className="flex justify-center gap-3" style={{ marginBottom: "28px" }}>
            {!isRunning && (
              <button onClick={start} className="flex items-center gap-2"
                style={{
                  padding: "12px 32px", borderRadius: "var(--radius-lg)",
                  background: "linear-gradient(135deg, var(--glow-a), var(--glow-b))",
                  color: "white", fontWeight: 600, fontSize: "14px",
                  boxShadow: "0 0 24px var(--accent-glow)",
                  border: "1px solid var(--accent-border)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = "0 0 36px var(--accent-glow)"
                  e.currentTarget.style.transform = "translateY(-1px)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = "0 0 24px var(--accent-glow)"
                  e.currentTarget.style.transform = "translateY(0)"
                }}
              >
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {isPaused ? "Resume" : "Start"}
              </button>
            )}

            {isRunning && (
              <button onClick={pause} className="flex items-center gap-2"
                style={{
                  padding: "12px 32px", borderRadius: "var(--radius-lg)",
                  background: "var(--accent-dim)",
                  color: "var(--accent)", fontWeight: 600, fontSize: "14px",
                  boxShadow: "0 0 20px var(--accent-glow)",
                  border: "1px solid var(--accent-border)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(129,140,248,0.25)"
                  e.currentTarget.style.transform = "translateY(-1px)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "var(--accent-dim)"
                  e.currentTarget.style.transform = "translateY(0)"
                }}
              >
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
                Pause
              </button>
            )}

            {(isRunning || isPaused) && (
              <button onClick={stop} className="flex items-center gap-2"
                style={{
                  padding: "12px 24px", borderRadius: "var(--radius-lg)",
                  background: "rgba(248,113,113,0.12)",
                  color: "var(--color-red)", fontWeight: 600, fontSize: "14px",
                  border: "1px solid rgba(248,113,113,0.25)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(248,113,113,0.22)"
                  e.currentTarget.style.transform = "translateY(-1px)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(248,113,113,0.12)"
                  e.currentTarget.style.transform = "translateY(0)"
                }}
              >
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h12v12H6z" />
                </svg>
                Stop
              </button>
            )}
          </div>

          {/* ── Pomodoro Settings ── */}
          {tool === "pomodoro" && (
            <div style={{ paddingTop: "24px", borderTop: "1px solid var(--glass-border)" }}>
              <p style={{
                textAlign: "center", fontSize: "11px", fontWeight: 700,
                letterSpacing: "0.8px", textTransform: "uppercase",
                color: "var(--text-tertiary)", marginBottom: "18px",
              }}>
                Settings
              </p>

              <div className="flex justify-center gap-6" style={{ marginBottom: "18px" }}>
                {[
                  { label: "Work (min)",  value: workInput,  set: setWorkInput,  max: 60 },
                  { label: "Break (min)", value: breakInput, set: setBreakInput, max: 30 },
                ].map(({ label, value, set, max }) => (
                  <div key={label} className="flex flex-col items-center gap-2">
                    <label style={{
                      fontSize: "10.5px", fontWeight: 600,
                      color: "var(--text-tertiary)", letterSpacing: "0.3px",
                    }}>
                      {label}
                    </label>
                    <input
                      type="number" value={value}
                      disabled={isRunning}
                      onChange={e => set(+e.target.value)}
                      min="1" max={max}
                      style={{
                        width: "72px", padding: "8px 0",
                        textAlign: "center", fontSize: "15px", fontWeight: 700,
                        borderRadius: "var(--radius-md)",
                        background: "var(--glass-bg)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-primary)",
                        opacity: isRunning ? 0.45 : 1,
                        cursor: isRunning ? "not-allowed" : "text",
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-center">
                <button
                  disabled={isRunning || workInput < 1 || breakInput < 1}
                  onClick={() => {
                    const validWork  = Math.max(1, Math.floor(workInput))
                    const validBreak = Math.max(1, Math.floor(breakInput))
                    updateSettings(validWork, validBreak)
                  }}
                  style={{
                    padding: "8px 24px", borderRadius: "var(--radius-md)",
                    fontSize: "12px", fontWeight: 600,
                    background: isRunning || workInput < 1 || breakInput < 1
                      ? "var(--glass-bg)" : "var(--accent-dim)",
                    border: "1px solid",
                    borderColor: isRunning || workInput < 1 || breakInput < 1
                      ? "var(--glass-border)" : "var(--accent-border)",
                    color: isRunning || workInput < 1 || breakInput < 1
                      ? "var(--text-tertiary)" : "var(--accent)",
                    cursor: isRunning || workInput < 1 || breakInput < 1
                      ? "not-allowed" : "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Helper text ── */}
        <p style={{
          textAlign: "center", marginTop: "16px",
          fontSize: "11px", color: "var(--text-tertiary)", lineHeight: 1.6,
        }}>
          {tool === "pomodoro"
            ? "25 min focus · 5 min break — The Pomodoro Technique"
            : "Track elapsed time with the stopwatch"}
        </p>
      </div>
    </div>
  )
}