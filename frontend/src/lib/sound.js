// Alarm sound engine built on the Web Audio API (no audio files, works offline).
let ctx = null
let master = null
let loop = null

const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null
function getCtx() {
  if (!AC) return null
  if (!ctx) ctx = new AC()
  return ctx
}

export function unlockAudio() {
  const c = getCtx()
  if (c && c.state === 'suspended') return c.resume().catch(() => {})
  return Promise.resolve()
}
export const audioState = () => (ctx ? ctx.state : 'suspended')

function tone(c, dest, { freq, type = 'sine', t, dur, vol = 1 }) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(dest)
  o.start(t)
  o.stop(t + dur + 0.05)
}

const PATTERNS = {
  classic: { ms: 1600, play: (c, d, t) => [0, 1, 2].forEach((i) => tone(c, d, { freq: 880, type: 'square', t: t + i * 0.3, dur: 0.18, vol: 0.28 })) },
  chime: { ms: 2200, play: (c, d, t) => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, d, { freq: f, t: t + i * 0.32, dur: 0.9, vol: 0.5 })) },
  pulse: { ms: 2000, play: (c, d, t) => [0, 1, 2, 3].forEach((i) => tone(c, d, { freq: 440, type: 'sawtooth', t: t + i * 0.45, dur: 0.3, vol: 0.28 })) },
  digital: { ms: 1600, play: (c, d, t) => [0, 1, 2, 3, 4, 5].forEach((i) => tone(c, d, { freq: 1320, type: 'square', t: t + i * 0.18, dur: 0.09, vol: 0.22 })) },
}

export function stopAlarmSound() {
  if (loop) { clearInterval(loop); loop = null }
  if (master && ctx) {
    try { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, 0.05) } catch { /* ignore */ }
    const m = master
    setTimeout(() => { try { m.disconnect() } catch { /* ignore */ } }, 300)
  }
  master = null
}

/** Start looping. Volume ramps up from 30% to the target over 12s (a gentler wake-up). */
export function startAlarmSound(kind = 'classic', volume = 80) {
  const c = getCtx()
  if (!c) return 'unsupported'
  stopAlarmSound()
  const p = PATTERNS[kind] || PATTERNS.classic
  master = c.createGain()
  master.connect(c.destination)
  const target = Math.max(0.05, Math.min(1, volume / 100))
  master.gain.setValueAtTime(target * 0.3, c.currentTime)
  master.gain.linearRampToValueAtTime(target, c.currentTime + 12)
  const playOnce = () => { if (c.state === 'running' && master) p.play(c, master, c.currentTime + 0.05) }
  c.resume().then(playOnce).catch(() => {})
  loop = setInterval(playOnce, p.ms)
  return c.state
}

export function previewSound(kind = 'classic', volume = 80) {
  const c = getCtx()
  if (!c) return
  c.resume().then(() => {
    const g = c.createGain()
    g.gain.value = Math.max(0.05, Math.min(1, volume / 100))
    g.connect(c.destination)
    ;(PATTERNS[kind] || PATTERNS.classic).play(c, g, c.currentTime + 0.05)
    setTimeout(() => g.disconnect(), 2600)
  })
}
