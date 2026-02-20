import { useState, useEffect, useCallback, useRef } from "react"

/* ─────────────────────────────────────────────
   Windows 11 OOBE-style welcome screen
   Total time: ~5.5 seconds
───────────────────────────────────────────── */

const PHASES: { text: string; sub?: string; duration: number }[] = [
  { text: "Hi",                                                             duration: 1400 },
  { text: "Welcome to ChorniNotes", sub: "Your personal productivity space", duration: 2000 },
  { text: "Setting things up…",                                             duration: 1200 },
  { text: "Let's go ✦",                                                     duration: 900  },
]

const TOTAL_DURATION = PHASES.reduce((s, p) => s + p.duration, 0)

interface Props {
  onFinished: () => void
}

export default function WelcomeScreen({ onFinished }: Props) {
  const [phase, setPhase] = useState(-1)
  const [fadeClass, setFadeClass] = useState("")
  const [exiting, setExiting] = useState(false)
  const [progress, setProgress] = useState(0)
  const startTime = useRef(0)
  const rafRef = useRef<number>(0)

  /* ── Smooth progress bar via requestAnimationFrame ── */
  useEffect(() => {
    startTime.current = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime.current
      const t = Math.min(elapsed / TOTAL_DURATION, 1)
      // Smooth ease-out curve with gentle deceleration
      const eased = 1 - Math.pow(1 - t, 3)
      setProgress(eased * 100)

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  /* Advance through phases */
  const advance = useCallback(() => {
    setPhase((prev) => {
      const next = prev + 1
      if (next >= PHASES.length) {
        setProgress(100)
        setExiting(true)
        setTimeout(onFinished, 700)
        return prev
      }
      return next
    })
  }, [onFinished])

  /* Kick off after mount */
  useEffect(() => {
    const t = setTimeout(() => setPhase(0), 350)
    return () => clearTimeout(t)
  }, [])

  /* Per-phase timer */
  useEffect(() => {
    if (phase < 0 || phase >= PHASES.length) return

    setFadeClass("ws-fade-in")

    const fadeOutDelay = PHASES[phase].duration - 450
    const fadeOutTimer = setTimeout(() => setFadeClass("ws-fade-out"), fadeOutDelay)
    const nextTimer = setTimeout(advance, PHASES[phase].duration)

    return () => {
      clearTimeout(fadeOutTimer)
      clearTimeout(nextTimer)
    }
  }, [phase, advance])

  const current = phase >= 0 && phase < PHASES.length ? PHASES[phase] : null
  const isGreeting = phase === 0
  const isFinal = phase === PHASES.length - 1

  return (
    <div className={`ws-container ${exiting ? "ws-exit" : ""}`}>
      {/* Animated gradient background */}
      <div className="ws-bg">
        <div 
          className="ws-gradient ws-gradient-1"
          style={{ transform: `translate(${progress * 0.4}px, ${progress * 0.3}px) scale(${1 + progress * 0.0012})` }}
        />
        <div 
          className="ws-gradient ws-gradient-2"
          style={{ transform: `translate(${progress * 0.4}px, ${progress * 0.3}px) scale(${1 + progress * 0.0012})` }}
        />
        <div 
          className="ws-gradient ws-gradient-3"
          style={{ transform: `translate(${progress * 0.4}px, ${progress * 0.3}px) scale(${1 + progress * 0.0012})` }}
        />
      </div>

      {/* Subtle radial spotlight */}
      <div className="ws-spotlight" />

      {/* Floating particles - disabled */}

      {/* Center content */}
      <div className="ws-center">
        {/* Logo */}
        <div className={`ws-logo ${phase >= 0 ? "ws-logo-visible" : ""}`}>
          <div className="ws-logo-ring" />
          <div className="ws-logo-inner">
            <span className="ws-logo-letter">C</span>
          </div>
        </div>

        {/* Text */}
        {current && (
          <div className={`ws-text-block ${fadeClass}`}>
            <h1
              className="ws-heading"
              style={{
                fontSize: isGreeting ? "4rem" : isFinal ? "2.6rem" : "2rem",
                fontWeight: isGreeting ? 300 : 600,
                letterSpacing: isGreeting ? "2px" : "-0.5px",
              }}
            >
              {current.text}
            </h1>
            {current.sub && (
              <p className="ws-subtext">{current.sub}</p>
            )}
          </div>
        )}

        {/* Loading dots — on middle phases (1 and 2) */}
        {(phase === 1 || phase === 2) && (
          <div className={`ws-dots ${fadeClass}`}>
            <span className="ws-dot" style={{ animationDelay: "0s" }} />
            <span className="ws-dot" style={{ animationDelay: "0.18s" }} />
            <span className="ws-dot" style={{ animationDelay: "0.36s" }} />
          </div>
        )}

        {/* Smooth progress bar */}
        {phase >= 0 && (
          <div className="ws-progress-track">
            <div
              className="ws-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <style>{welcomeStyles}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   SCOPED STYLES
═══════════════════════════════════════════════ */

const welcomeStyles = `
.ws-container {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #040608;
  overflow: hidden;
  transition: opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.7s cubic-bezier(0.4, 0, 0.2, 1),
              filter 0.7s cubic-bezier(0.4, 0, 0.2, 1);
}

.ws-exit {
  opacity: 0;
  transform: scale(1.06);
  filter: blur(6px);
  pointer-events: none;
}

.ws-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.ws-gradient {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  animation: wsGradientDrift 30s ease-in-out infinite alternate;
}

@keyframes wsGradientDrift {
  0%   { transform: translate(0, 0) scale(1); }
  50%  { transform: translate(20px, 15px) scale(1.05); }
  100% { transform: translate(40px, 30px) scale(1.12); }
}

.ws-gradient-1 {
  width: 650px; height: 650px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.35), transparent 70%);
  top: -15%; left: -10%;
  animation-delay: 0s;
}
.ws-gradient-2 {
  width: 550px; height: 550px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.30), transparent 70%);
  bottom: -15%; right: -5%;
  animation-delay: 0s;
}
.ws-gradient-3 {
  width: 380px; height: 380px;
  background: radial-gradient(circle, rgba(6, 182, 212, 0.25), transparent 70%);
  top: 50%; left: 55%;
  transform: translate(-50%, -50%);
  animation-delay: 0s;
}

.ws-spotlight {
  position: absolute;
  top: 50%; left: 50%;
  width: 900px; height: 900px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(129, 140, 248, 0.07) 0%, transparent 60%);
  pointer-events: none;
}

.ws-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ws-particle {
  position: absolute;
  border-radius: 50%;
  background: rgba(129, 140, 248, 0.6);
}

.ws-center {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
}

/* ── Logo ── */

.ws-logo {
  position: relative;
  width: 84px; height: 84px;
  opacity: 0;
  transform: scale(0.5) translateY(12px);
  transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1),
              transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
}
.ws-logo-visible {
  opacity: 1;
  transform: scale(1) translateY(0);
}

.ws-logo-ring {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 2px solid rgba(129, 140, 248, 0.25);
}

.ws-logo-inner {
  width: 100%; height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 40px rgba(99, 102, 241, 0.4),
              0 0 80px rgba(99, 102, 241, 0.15);
}

.ws-logo-letter {
  font-size: 34px;
  font-weight: 700;
  color: white;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  font-family: 'Inter', sans-serif;
}

/* ── Text ── */

.ws-text-block {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.ws-heading {
  margin: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.95) 30%, rgba(129,140,248,0.9));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.2;
}

.ws-subtext {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.42);
  font-weight: 400;
  letter-spacing: 0.3px;
  margin: 0;
}

/* ── Fade transitions (smoother & longer) ── */

.ws-fade-in {
  animation: wsFadeIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.ws-fade-out {
  animation: wsFadeOut 0.4s cubic-bezier(0.4, 0, 0.6, 1) forwards;
}

@keyframes wsFadeIn {
  from { opacity: 0; transform: translateY(20px) scale(0.96); filter: blur(4px); }
  to   { opacity: 1; transform: translateY(0) scale(1);       filter: blur(0px); }
}
@keyframes wsFadeOut {
  from { opacity: 1; transform: translateY(0) scale(1);        filter: blur(0px); }
  to   { opacity: 0; transform: translateY(-16px) scale(0.96); filter: blur(4px); }
}

/* ── Loading dots ── */

.ws-dots {
  display: flex;
  gap: 10px;
  margin-top: -8px;
}

.ws-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: rgba(129, 140, 248, 0.8);
  animation: wsDotBounce 1.2s ease-in-out infinite;
}

@keyframes wsDotBounce {
  0%, 80%, 100% {
    transform: scale(0.5) translateY(0);
    opacity: 0.25;
  }
  40% {
    transform: scale(1.3) translateY(-4px);
    opacity: 1;
    box-shadow: 0 0 14px rgba(129, 140, 248, 0.6);
  }
}

/* ── Smooth progress bar ── */

.ws-progress-track {
  width: 220px;
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
  margin-top: 4px;
}

.ws-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #6366f1, #818cf8, #8b5cf6);
  box-shadow: 0 0 14px rgba(129, 140, 248, 0.45);
  position: relative;
  will-change: width;
}

.ws-progress-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 100%
  );
  animation: wsShimmer 1.6s ease-in-out infinite;
}

@keyframes wsShimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
`
