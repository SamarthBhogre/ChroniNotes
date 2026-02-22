import { useEffect, useState, useRef } from "react"
import { useTimerStore } from "../store/timer.store"

/* ── useWindowHeight hook ── */
function useWindowHeight() {
  const [height, setHeight] = useState(window.innerHeight)
  useEffect(() => {
    const obs = new ResizeObserver(() => setHeight(window.innerHeight))
    obs.observe(document.body)
    const handler = () => setHeight(window.innerHeight)
    window.addEventListener("resize", handler)
    return () => {
      obs.disconnect()
      window.removeEventListener("resize", handler)
    }
  }, [])
  return height
}

/* ── SVG ring progress arc ── */
function RingProgress({
  progress, isRunning, isBreak, isPaused, compact,
}: {
  progress: number
  isRunning: boolean
  isBreak: boolean
  isPaused: boolean
  compact?: boolean
}) {
  const size   = compact ? 140 : 200
  const stroke = 3
  const r      = (size - stroke * 2) / 2
  const circ   = 2 * Math.PI * r
  const offset = circ * (1 - Math.max(0, Math.min(1, progress)))

  // All colors now via CSS variables — theme-aware
  const color = isPaused
    ? "var(--accent-border)"
    : isBreak
    ? "var(--color-green)"
    : "var(--accent)"

  return (
    <svg
      width={size} height={size}
      style={{
        position: "absolute", inset: 0,
        transform: "rotate(-90deg)",
        transition: "opacity 0.4s ease",
        opacity: isRunning || isPaused ? 1 : 0.25,
      }}
    >
      <defs>
        <filter id="ringGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Track ring — uses glass border so it's visible on both light & dark */}
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--glass-border-strong)" strokeWidth={stroke}
      />

      {/* Progress arc */}
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        filter="url(#ringGlow)"
        style={{
          transition: "stroke-dashoffset 1.05s cubic-bezier(0.4,0,0.2,1), stroke 0.6s ease",
        }}
      />
    </svg>
  )
}

/* ── Animated digit ── */
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
    <span style={{
      display: "inline-block",
      transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease",
      transform: flip ? "translateY(-4px) scale(1.08)" : "translateY(0) scale(1)",
      opacity:   flip ? 0.6 : 1,
    }}>
      {value}
    </span>
  )
}

function AnimTimer({ seconds, compact }: { seconds: number; compact?: boolean }) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0")
  const s = (seconds % 60).toString().padStart(2, "0")
  return (
    <>
      <AnimDigit value={m[0]} />
      <AnimDigit value={m[1]} />
      <span style={{
        opacity: 0.4,
        margin: compact ? "0 1px" : "0 2px",
        fontWeight: 300,
      }}>:</span>
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
    workMinutes, breakMinutes, customMinutes, setCustom,
    start, pause, stop,
    loadSettings, updateSettings, updateFromMain,
  } = useTimerStore()

  const [workInput,   setWorkInput]   = useState(workMinutes)
  const [breakInput,  setBreakInput]  = useState(breakMinutes)
  const [customInput, setCustomInput] = useState(customMinutes)

  const windowHeight = useWindowHeight()
  const isHorizontal = windowHeight < 520
  const isTiny       = windowHeight < 380

  useEffect(() => { loadSettings() }, [])
  useEffect(() => {
    setWorkInput(workMinutes)
    setBreakInput(breakMinutes)
  }, [workMinutes, breakMinutes])
  useEffect(() => { setCustomInput(customMinutes) }, [customMinutes])
  useEffect(() => { window.electron.on("timer:update", updateFromMain) }, [])

  const isBreak = tool === "pomodoro" && isRunning && mode === "break"

  const statusText = isRunning
    ? tool === "pomodoro"
      ? mode === "work" ? "Focus session active" : "Break time active"
      : tool === "stopwatch" ? "Stopwatch running" : "Timer running"
    : isPaused ? "Session paused"
    : "Ready to start"

  const totalSeconds =
    tool === "pomodoro"
      ? (mode === "work" ? workMinutes : breakMinutes) * 60
      : tool === "timer" ? customInput * 60 : 0

  const progress = totalSeconds > 0 ? seconds / totalSeconds : 1

  const ringSize     = isHorizontal ? 140 : 200
  const fontSizeTimer = isHorizontal ? "1.7rem" : "clamp(2rem, 8vw, 2.6rem)"

  // Timer digit color — fully CSS-var based
  const timerColor = isRunning
    ? isBreak ? "var(--color-green)" : "var(--text-primary)"
    : isPaused ? "var(--accent)"
    : "var(--text-secondary)"

  // Clock face ring border color — CSS-var based
  const ringBorderColor = isRunning
    ? isBreak ? "var(--color-green)" : "var(--accent-border)"
    : "var(--glass-border)"

  // Clock face glow — CSS-var based
  const ringGlow = isRunning
    ? `0 0 32px var(--accent-glow), inset 0 0 20px var(--accent-dim)`
    : "none"

  /* ── Mode toggle (shared) ── */
  const ModeToggle = ({ align = "center" }: { align?: "center" | "left" }) => (
    <div style={{
      display: "flex",
      width: "fit-content",
      padding: "3px",
      borderRadius: "var(--radius-lg)",
      background: "var(--glass-bg)",
      border: "1px solid var(--glass-border)",
      ...(align === "center" ? { margin: "0 auto" } : {}),
    }}>
      {(["pomodoro", "timer", "stopwatch"] as const).map(t => (
        <button key={t} onClick={() => setTool(t as any)} style={{
          padding: isHorizontal ? "5px 12px" : "6px clamp(12px, 3vw, 18px)",
          borderRadius: "var(--radius-sm)",
          fontSize: "11.5px", fontWeight: 600,
          color: tool === t ? "var(--text-primary)" : "var(--text-tertiary)",
          background: tool === t ? "var(--glass-bg-hover)" : "transparent",
          border: `1px solid ${tool === t ? "var(--glass-border-strong)" : "transparent"}`,
          boxShadow: tool === t ? "var(--glass-shadow)" : "none",
          transition: "all 0.2s ease",
          textTransform: "capitalize",
        }}>
          {t}
        </button>
      ))}
    </div>
  )

  /* ── Clock face + status ── */
  const ClockBlock = (
    <div style={{ textAlign: "center", flexShrink: 0 }}>
      <div style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: `${ringSize}px`,
        height: `${ringSize}px`,
        borderRadius: "50%",
        // Glass bg adapts: light on dark themes, white on light themes
        background: "var(--glass-bg)",
        border: `1.5px solid ${ringBorderColor}`,
        boxShadow: ringGlow,
        transition: "border-color 0.6s ease, box-shadow 0.6s ease, background 0.4s ease",
        marginBottom: isHorizontal ? 0 : "12px",
        position: "relative",
      }}>
        <RingProgress
          progress={progress}
          isRunning={isRunning}
          isBreak={isBreak}
          isPaused={isPaused}
          compact={isHorizontal}
        />

        {/* Inner ring decoration */}
        <div style={{
          position: "absolute",
          inset: isHorizontal ? "8px" : "12px",
          borderRadius: "50%",
          border: `1px solid ${isRunning ? "var(--accent-border)" : "var(--glass-border)"}`,
          transition: "border-color 0.6s ease",
        }} />

        <span style={{
          fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
          fontSize: fontSizeTimer,
          fontWeight: 700, letterSpacing: "-1.5px",
          fontVariantNumeric: "tabular-nums",
          color: timerColor,
          transition: "color 0.4s ease",
          position: "relative", zIndex: 1,
          display: "inline-flex", alignItems: "center",
        }}>
          <AnimTimer seconds={seconds} compact={isHorizontal} />
        </span>
      </div>

      {/* Status dot + text */}
      {!isTiny && (
        <div className="flex items-center justify-center gap-2"
          style={{ marginTop: isHorizontal ? "8px" : 0 }}>
          {(isRunning || isPaused) && (
            <span style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: isBreak ? "var(--color-green)" : "var(--accent)",
              boxShadow: `0 0 5px ${isBreak ? "var(--color-green)" : "var(--accent)"}`,
              display: "inline-block",
              animation: isRunning ? "pulse-glow 2s ease-in-out infinite" : "none",
            }} />
          )}
          <span style={{
            fontSize: "11px", fontWeight: 500,
            color: isRunning
              ? isBreak ? "var(--color-green)" : "var(--accent)"
              : isPaused ? "var(--accent)"
              : "var(--text-tertiary)",
            transition: "color 0.4s ease",
          }}>
            {statusText}
          </span>
        </div>
      )}
    </div>
  )

  /* ── Controls ── */
  const ControlsBlock = (
    <div className="flex justify-center gap-2 flex-wrap" style={{ flexShrink: 0 }}>
      {!isRunning && (
        <button onClick={start} className="flex items-center gap-2"
          style={{
            padding: isHorizontal ? "7px 20px" : "10px 28px",
            borderRadius: "var(--radius-lg)",
            background: "linear-gradient(135deg, var(--glow-a), var(--glow-b))",
            color: "white", fontWeight: 600,
            fontSize: isHorizontal ? "12px" : "13px",
            boxShadow: "0 0 20px var(--accent-glow)",
            border: "1px solid var(--accent-border)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = "0 0 30px var(--accent-glow)"
            e.currentTarget.style.transform = "translateY(-1px)"
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = "0 0 20px var(--accent-glow)"
            e.currentTarget.style.transform = "translateY(0)"
          }}
        >
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          {isPaused ? "Resume" : "Start"}
        </button>
      )}

      {isRunning && (
        <button onClick={pause} className="flex items-center gap-2"
          style={{
            padding: isHorizontal ? "7px 20px" : "10px 28px",
            borderRadius: "var(--radius-lg)",
            background: "var(--accent-dim)",
            color: "var(--accent)", fontWeight: 600,
            fontSize: isHorizontal ? "12px" : "13px",
            boxShadow: "0 0 16px var(--accent-glow)",
            border: "1px solid var(--accent-border)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "var(--accent-border)"
            e.currentTarget.style.transform = "translateY(-1px)"
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "var(--accent-dim)"
            e.currentTarget.style.transform = "translateY(0)"
          }}
        >
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
          Pause
        </button>
      )}

      {(isRunning || isPaused) && (
        <button onClick={stop} className="flex items-center gap-2"
          style={{
            padding: isHorizontal ? "7px 16px" : "10px 20px",
            borderRadius: "var(--radius-lg)",
            background: "var(--accent-dim)",
            color: "var(--color-red)", fontWeight: 600,
            fontSize: isHorizontal ? "12px" : "13px",
            border: "1px solid var(--accent-border)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "var(--glass-bg-hover)"
            e.currentTarget.style.transform = "translateY(-1px)"
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "var(--accent-dim)"
            e.currentTarget.style.transform = "translateY(0)"
          }}
        >
          <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h12v12H6z" />
          </svg>
          Stop
        </button>
      )}
    </div>
  )

  /* ── Settings block ── */
  const SettingsBlock = (
    <div style={{ minHeight: 0 }}>
      {tool === "pomodoro" && (
        <SettingsSection title="Pomodoro Settings" compact={isHorizontal}>
          <div className="flex justify-center gap-4 flex-wrap" style={{ marginBottom: "10px" }}>
            {[
              { label: "Work", value: workInput, set: setWorkInput, max: 120 },
              { label: "Break", value: breakInput, set: setBreakInput, max: 60 },
            ].map(({ label, value, set, max }) => (
              <InputField key={label} label={label} value={value} onChange={set}
                max={max} disabled={isRunning} compact={isHorizontal}
              />
            ))}
          </div>
          <div className="flex justify-center">
            <button
              disabled={isRunning || workInput < 1 || breakInput < 1}
              onClick={() => updateSettings(
                Math.max(1, Math.floor(workInput)),
                Math.max(1, Math.floor(breakInput))
              )}
              style={{
                padding: isHorizontal ? "5px 16px" : "7px 20px",
                borderRadius: "var(--radius-md)",
                fontSize: "11px", fontWeight: 600,
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
        </SettingsSection>
      )}

      {tool === "timer" && (
        <SettingsSection title="Custom Timer" compact={isHorizontal}>
          <div className="flex flex-col items-center gap-2">
            <InputField
              label="Duration" value={customInput}
              onChange={v => { setCustomInput(v); setCustom(v) }}
              max={240} disabled={isRunning} compact={isHorizontal}
            />
            <QuickPresets
              value={customInput}
              onChange={v => { setCustomInput(v); setCustom(v) }}
              disabled={isRunning} compact={isHorizontal}
            />
          </div>
        </SettingsSection>
      )}

      {tool === "stopwatch" && !isHorizontal && (
        <p style={{
          textAlign: "center", fontSize: "11px",
          color: "var(--text-tertiary)", lineHeight: 1.5,
          padding: "12px", fontStyle: "italic",
        }}>
          Track elapsed time with no limit
        </p>
      )}
    </div>
  )

  /* ══════════════════════════════════
     RENDER
  ══════════════════════════════════ */
  return (
    <div
      className="h-full flex flex-col"
      style={{ color: "var(--text-primary)", overflow: isTiny ? "auto" : "hidden" }}
    >
      {isHorizontal ? (
        /* ── HORIZONTAL LAYOUT ── */
        <div style={{
          flex: 1, display: "flex", alignItems: "stretch",
          padding: "10px 16px", gap: "12px",
          minHeight: 0, overflow: isTiny ? "auto" : "hidden",
        }}>
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            flexShrink: 0, gap: "10px",
          }}>
            {ClockBlock}
            {ControlsBlock}
          </div>

          <div style={{
            width: "1px", background: "var(--glass-border)",
            flexShrink: 0, alignSelf: "stretch", margin: "4px 0",
          }} />

          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            gap: "10px", overflowY: isTiny ? "auto" : "hidden", minHeight: 0,
          }}>
            <ModeToggle align="left" />
            <div style={{ flex: 1, minHeight: 0 }}>{SettingsBlock}</div>
          </div>
        </div>

      ) : (
        /* ── VERTICAL LAYOUT ── */
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          maxWidth: "540px", width: "100%",
          margin: "0 auto",
          padding: "clamp(24px, 5vh, 48px) clamp(20px, 4vw, 32px)",
          overflow: "hidden", minHeight: 0,
        }}>
          {/* Header */}
          <div style={{ marginBottom: "clamp(20px, 4vh, 32px)", flexShrink: 0 }}>
            <div className="inline-flex items-center gap-2 mb-3" style={{
              padding: "3px 10px", borderRadius: "20px",
              background: "var(--accent-dim)",
              border: "1px solid var(--accent-border)",
              fontSize: "10px", fontWeight: 600,
              color: "var(--accent)", letterSpacing: "0.3px",
            }}>
              ⊹ Timer
            </div>
            <h1 style={{
              fontSize: "clamp(1.6rem, 5vw, 2rem)", fontWeight: 700,
              letterSpacing: "-0.5px", lineHeight: 1.15, marginBottom: "6px",
              background: "linear-gradient(135deg, var(--text-primary) 40%, var(--accent))",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Timer
            </h1>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              Stay focused with Pomodoro, custom timer, or stopwatch
            </p>
          </div>

          {/* Glass card */}
          <div className="glass" style={{
            borderRadius: "var(--radius-xl)",
            padding: "clamp(20px, 4vh, 28px) clamp(18px, 3vw, 24px)",
            position: "relative", overflow: "hidden",
            flex: 1, display: "flex", flexDirection: "column", minHeight: 0,
          }}>
            {/* Ambient glow */}
            <div style={{
              position: "absolute", top: "-50px", left: "50%",
              transform: "translateX(-50%)",
              width: "250px", height: "250px", borderRadius: "50%",
              background: isBreak ? "var(--glow-c)" : isRunning ? "var(--glow-a)" : "var(--glow-b)",
              opacity: isRunning ? 0.08 : 0.04,
              filter: "blur(50px)", pointerEvents: "none",
              transition: "opacity 1s ease, background 1.5s ease",
            }} />

            {/* Mode toggle */}
            <div style={{ marginBottom: "clamp(20px, 4vh, 28px)", flexShrink: 0 }}>
              <ModeToggle />
            </div>

            {/* Ring */}
            <div style={{
              textAlign: "center",
              marginBottom: "clamp(16px, 3vh, 24px)",
              flexShrink: 0,
            }}>
              {ClockBlock}
            </div>

            {/* Controls */}
            <div style={{ marginBottom: "clamp(16px, 3vh, 20px)", flexShrink: 0 }}>
              {ControlsBlock}
            </div>

            {/* Settings */}
            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
              {SettingsBlock}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Settings Section ── */
function SettingsSection({ title, children, compact }: {
  title: string; children: React.ReactNode; compact?: boolean
}) {
  return (
    <div style={{
      paddingTop: compact ? "10px" : "clamp(16px, 3vh, 20px)",
      borderTop: "1px solid var(--glass-border)",
    }}>
      <p style={{
        textAlign: "center", fontSize: "10px", fontWeight: 700,
        letterSpacing: "0.8px", textTransform: "uppercase",
        color: "var(--text-tertiary)",
        marginBottom: compact ? "8px" : "clamp(12px, 2vh, 16px)",
      }}>
        {title}
      </p>
      {children}
    </div>
  )
}

/* ── Input Field ── */
function InputField({ label, value, onChange, max, disabled, compact }: {
  label: string; value: number; onChange: (v: number) => void
  max: number; disabled: boolean; compact?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <label style={{
        fontSize: "10px", fontWeight: 600,
        color: "var(--text-tertiary)", letterSpacing: "0.2px",
      }}>
        {label} (min)
      </label>
      <input
        type="number" value={value} disabled={disabled}
        onChange={e => onChange(+e.target.value)}
        min="1" max={max}
        style={{
          width: compact ? "58px" : "68px",
          padding: compact ? "5px 0" : "7px 0",
          textAlign: "center",
          fontSize: compact ? "13px" : "14px", fontWeight: 700,
          borderRadius: "var(--radius-md)",
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          color: "var(--text-primary)",
          opacity: disabled ? 0.45 : 1,
          cursor: disabled ? "not-allowed" : "text",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
        onFocus={e => {
          if (!disabled) {
            e.currentTarget.style.borderColor = "var(--accent-border)"
            e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-glow)"
          }
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = "var(--glass-border)"
          e.currentTarget.style.boxShadow = "none"
        }}
      />
    </div>
  )
}

/* ── Quick Presets ── */
function QuickPresets({ value, onChange, disabled, compact }: {
  value: number; onChange: (v: number) => void; disabled: boolean; compact?: boolean
}) {
  const presets = [5, 10, 15, 30, 60]
  return (
    <div className="flex gap-1.5 flex-wrap justify-center">
      {presets.map(p => (
        <button key={p} onClick={() => onChange(p)} disabled={disabled}
          style={{
            padding: compact ? "4px 9px" : "5px 12px",
            borderRadius: "var(--radius-sm)",
            fontSize: "10.5px", fontWeight: 600,
            background: value === p ? "var(--accent-dim)" : "var(--glass-bg)",
            border: `1px solid ${value === p ? "var(--accent-border)" : "var(--glass-border)"}`,
            color: value === p ? "var(--accent)" : "var(--text-secondary)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.45 : 1,
            transition: "all 0.18s ease",
          }}
          onMouseEnter={e => {
            if (!disabled && value !== p) {
              e.currentTarget.style.background = "var(--glass-bg-hover)"
              e.currentTarget.style.borderColor = "var(--glass-border-strong)"
            }
          }}
          onMouseLeave={e => {
            if (value !== p) {
              e.currentTarget.style.background = "var(--glass-bg)"
              e.currentTarget.style.borderColor = "var(--glass-border)"
            }
          }}
        >
          {p}m
        </button>
      ))}
    </div>
  )
}