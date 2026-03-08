/**
 * Notification Sound System
 * Uses the Web Audio API to generate notification tones without external audio files.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

/** Play a soft ascending chime — used for timer completion, pomodoro phase change */
export function playTimerComplete() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99] // C5, E5, G5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + i * 0.15)
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.15 + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + i * 0.15)
      osc.stop(now + i * 0.15 + 0.5)
    })
  } catch { /* Audio not available */ }
}

/** Short "tick" sound — used for habit check-off */
export function playHabitCheck() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = 880 // A5
    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.15)
  } catch { /* Audio not available */ }
}

/** Gentle descending tone — used for break start */
export function playBreakStart() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    const notes = [783.99, 659.25, 523.25] // G5, E5, C5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + i * 0.18)
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.18 + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + i * 0.18)
      osc.stop(now + i * 0.18 + 0.45)
    })
  } catch { /* Audio not available */ }
}

/** Quick success fanfare — used for task completion, goal reached */
export function playSuccess() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "triangle"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + i * 0.1)
      gain.gain.linearRampToValueAtTime(0.1, now + i * 0.1 + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + i * 0.1)
      osc.stop(now + i * 0.1 + 0.3)
    })
  } catch { /* Audio not available */ }
}

/** Alert/warning tone — used for overdue tasks, errors */
export function playAlert() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "square"
    osc.frequency.value = 440
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02)
    gain.gain.setValueAtTime(0.08, now + 0.1)
    gain.gain.linearRampToValueAtTime(0, now + 0.12)
    gain.gain.setValueAtTime(0, now + 0.2)
    gain.gain.linearRampToValueAtTime(0.08, now + 0.22)
    gain.gain.linearRampToValueAtTime(0, now + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.4)
  } catch { /* Audio not available */ }
}
