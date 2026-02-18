import { useState, useEffect, useCallback, useRef } from "react"

/* ─────────────────────────────────────────────
   Windows 11 OOBE-style welcome screen
   Total time: ~3 seconds
───────────────────────────────────────────── */

const PHASES: { text: string; sub?: string; duration: number }[] = [
  { text: "Hi",                                                            duration: 900  },
  { text: "Welcome to ChorniNotes", sub: "Your personal productivity space", duration: 1000 },
  { text: "Let's go",                                                      duration: 700  },
]

const TOTAL_DURATION = PHASES.reduce((s, p) => s + p.duration, 0) // ~2600ms + delays

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
      // Ease-out curve for smooth deceleration
      const eased = 1 - Math.pow(1 - t, 2.5)
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
        setTimeout(onFinished, 500)
        return prev
      }
      return next
    })
  }, [onFinished])

  /* Kick off after mount */
  useEffect(() => {
    const t = setTimeout(() => setPhase(0), 200)
    return () => clearTimeout(t)
  }, [])

  /* Per-phase timer */
  useEffect(() => {
    if (phase < 0 || phase >= PHASES.length) return

    setFadeClass("ws-fade-in")

    const fadeOutDelay = PHASES[phase].duration - 300
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
        <div className="ws-gradient ws-gradient-1" />
        <div className="ws-gradient ws-gradient-2" />
        <div className="ws-gradient ws-gradient-3" />
      </div>

      {/* Subtle radial spotlight */}
      <div className="ws-spotlight" />

      {/* Floating particles */}
      <div className="ws-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="ws-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${6 + Math.random() * 8}s`,
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              opacity: 0.15 + Math.random() * 0.25,
            }}
          />
        ))}
      </div>

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

        {/* Loading dots — only on middle phase */}
        {phase === 1 && (
          <div className={`ws-dots ${fadeClass}`}>
            <span className="ws-dot" style={{ animationDelay: "0s" }} />
            <span className="ws-dot" style={{ animationDelay: "0.15s" }} />
            <span className="ws-dot" style={{ animationDelay: "0.3s" }} />
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
  transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.ws-exit {
  opacity: 0;
  transform: scale(1.04);
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
  filter: blur(100px);
  animation: wsGradientDrift 12s ease-in-out infinite alternate;
}

.ws-gradient-1 {
  width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.25), transparent 70%);
  top: -15%; left: -10%;
  animation-delay: 0s;
}
.ws-gradient-2 {
  width: 500px; height: 500px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.20), transparent 70%);
  bottom: -15%; right: -5%;
  animation-delay: -4s;
}
.ws-gradient-3 {
  width: 350px; height: 350px;
  background: radial-gradient(circle, rgba(6, 182, 212, 0.15), transparent 70%);
  top: 50%; left: 55%;
  transform: translate(-50%, -50%);
  animation-delay: -8s;
}

@keyframes wsGradientDrift {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(40px, 30px) scale(1.1); }
}

.ws-spotlight {
  position: absolute;
  top: 50%; left: 50%;
  width: 800px; height: 800px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(129, 140, 248, 0.06) 0%, transparent 60%);
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
  animation: wsParticleFloat linear infinite;
}

@keyframes wsParticleFloat {
  0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(-120px) translateX(30px) scale(0.5); opacity: 0; }
}

.ws-center {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

.ws-logo {
  position: relative;
  width: 80px; height: 80px;
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ws-logo-visible {
  opacity: 1;
  transform: scale(1);
}

.ws-logo-ring {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 2px solid rgba(129, 140, 248, 0.3);
  animation: wsRingPulse 2s ease-in-out infinite;
}

@keyframes wsRingPulse {
  0%, 100% { transform: scale(1); opacity: 0.4; border-color: rgba(129, 140, 248, 0.3); }
  50% { transform: scale(1.08); opacity: 0.8; border-color: rgba(129, 140, 248, 0.6); }
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
  animation: wsLogoGlow 3s ease-in-out infinite alternate;
}

@keyframes wsLogoGlow {
  0% { box-shadow: 0 8px 40px rgba(99, 102, 241, 0.35), 0 0 60px rgba(99, 102, 241, 0.1); }
  100% { box-shadow: 0 8px 50px rgba(99, 102, 241, 0.5), 0 0 100px rgba(99, 102, 241, 0.2); }
}

.ws-logo-letter {
  font-size: 32px;
  font-weight: 700;
  color: white;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  font-family: 'Inter', sans-serif;
}

.ws-text-block {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
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
  color: rgba(255, 255, 255, 0.45);
  font-weight: 400;
  letter-spacing: 0.3px;
  margin: 0;
}

.ws-fade-in {
  animation: wsFadeIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.ws-fade-out {
  animation: wsFadeOut 0.25s cubic-bezier(0.4, 0, 1, 1) forwards;
}

@keyframes wsFadeIn {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes wsFadeOut {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(-12px) scale(0.97); }
}

.ws-dots {
  display: flex;
  gap: 8px;
  margin-top: -8px;
}

.ws-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: rgba(129, 140, 248, 0.8);
  animation: wsDotBounce 1s ease-in-out infinite;
}

@keyframes wsDotBounce {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.3;
  }
  40% {
    transform: scale(1.2);
    opacity: 1;
    box-shadow: 0 0 12px rgba(129, 140, 248, 0.6);
  }
}

/* ── Smooth progress bar ── */
.ws-progress-track {
  width: 200px;
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  margin-top: 4px;
}

.ws-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #6366f1, #818cf8, #8b5cf6);
  box-shadow: 0 0 12px rgba(129, 140, 248, 0.4);
  position: relative;
  /* No CSS transition — driven by rAF for buttery smoothness */
  will-change: width;
}

.ws-progress-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.35) 50%,
    transparent 100%
  );
  animation: wsShimmer 1.2s ease-in-out infinite;
}

@keyframes wsShimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
`
