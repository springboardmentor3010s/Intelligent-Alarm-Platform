import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlarmClock, BellOff, Brain, CheckCircle2, Clock, Flame, Moon, Volume2, XCircle, Zap } from 'lucide-react'
import client, { errorMessage } from '../api/client'
import { useAlarm, useNow } from '../context/AlarmContext'
import { TYPE_LABEL, titleCase } from '../lib/format'
import { Button, ScoreRing, cx } from './ui'

function TimerRing({ left, total }) {
  const r = 22, c = 2 * Math.PI * r, f = total ? Math.max(0, Math.min(1, left / total)) : 0
  return (
    <div className="relative grid h-14 w-14 place-items-center">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="4" stroke="rgba(255,255,255,.15)" />
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="4" strokeLinecap="round" stroke={left <= 8 ? '#FF6B6B' : '#FF9457'}
          strokeDasharray={c} strokeDashoffset={c * (1 - f)} style={{ transition: 'stroke-dashoffset .25s linear' }} />
      </svg>
      <span className="num absolute text-sm font-semibold text-white">{Math.ceil(left)}</span>
    </div>
  )
}

function ChallengeCard({ session, onResult }) {
  const ch = session.challenge
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [left, setLeft] = useState(ch.seconds_left)
  const [revealLeft, setRevealLeft] = useState(ch.display ? ch.reveal_seconds : 0)
  const [shakeKey, setShakeKey] = useState(0)
  const startedAt = useRef(performance.now())
  const submitted = useRef(false)
  const inputRef = useRef(null)

  useEffect(() => {
    startedAt.current = performance.now()
    submitted.current = false
    setAnswer(''); setBusy(false); setLeft(ch.seconds_left)
    setRevealLeft(ch.display ? Math.max(0, ch.reveal_seconds - (ch.time_limit_seconds - ch.seconds_left)) : 0)
  }, [ch.id]) // eslint-disable-line

  const submit = useCallback(async (value) => {
    if (submitted.current) return
    submitted.current = true
    setBusy(true)
    try {
      const { data } = await client.post(`/wake/${session.id}/answer`, { instance_id: ch.id, answer: value })
      setFeedback({ ok: data.correct, text: data.message })
      if (!data.correct) setShakeKey((k) => k + 1)
      onResult(data)
    } catch (e) {
      submitted.current = false
      setBusy(false)
      setFeedback({ ok: false, text: errorMessage(e) })
    }
  }, [session.id, ch.id, onResult])

  useEffect(() => {
    const t = setInterval(() => {
      const el = (performance.now() - startedAt.current) / 1000
      const l = Math.max(0, ch.seconds_left - el)
      setLeft(l)
      if (ch.display) setRevealLeft(Math.max(0, ch.reveal_seconds - (ch.time_limit_seconds - ch.seconds_left) - el))
      if (l <= 0) submit('')  // out of time -> server records a timeout and issues a new challenge
    }, 250)
    return () => clearInterval(t)
  }, [ch.id, submit]) // eslint-disable-line

  const revealing = ch.display && revealLeft > 0
  useEffect(() => { if (!revealing) inputRef.current?.focus() }, [revealing, ch.id])
  const numeric = ['math', 'pattern', 'memory'].includes(ch.challenge_type)

  return (
    <motion.div key={ch.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
      <div key={shakeKey} className={cx('rounded-3xl border border-white/15 bg-white/[.07] p-6 shadow-2xl backdrop-blur-xl sm:p-8', shakeKey > 0 && 'animate-shake')}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white"><Brain className="h-3.5 w-3.5" />{TYPE_LABEL[ch.challenge_type]}</span>
            <span className="rounded-full bg-[#FF9457]/20 px-3 py-1 text-xs font-medium capitalize text-[#FFB98A]">{ch.difficulty}</span>
          </div>
          <TimerRing left={left} total={ch.time_limit_seconds} />
        </div>

        {revealing ? (
          <div className="py-4 text-center">
            <p className="mb-4 text-sm text-white/70">Memorise this sequence…</p>
            <motion.p initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="num text-5xl font-semibold tracking-[.25em] text-white sm:text-6xl">{ch.display}</motion.p>
            <p className="mt-5 text-xs text-white/50">Hides in {Math.ceil(revealLeft)}s</p>
          </div>
        ) : (
          <>
            <p className="font-display text-2xl leading-snug text-white sm:text-3xl">{ch.prompt}</p>
            {ch.options ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {ch.options.map((o) => (
                  <button key={o} disabled={busy} onClick={() => submit(o)}
                    className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3.5 text-left text-base font-medium text-white transition hover:border-[#FF9457] hover:bg-white/20 disabled:opacity-50">{o}</button>
                ))}
              </div>
            ) : (
              <form className="mt-6 flex gap-3" onSubmit={(e) => { e.preventDefault(); if (answer.trim()) submit(answer.trim()) }}>
                <input ref={inputRef} value={answer} onChange={(e) => setAnswer(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck="false"
                  inputMode={numeric ? 'numeric' : 'text'} placeholder="Your answer" aria-label="Your answer" maxLength={60}
                  className="num min-w-0 flex-1 rounded-2xl border border-white/25 bg-black/25 px-5 py-4 text-center text-2xl text-white placeholder:text-white/35 focus:border-[#FF9457] focus:outline-none focus:ring-2 focus:ring-[#FF9457]/40" />
                <button type="submit" disabled={busy || !answer.trim()} className="rounded-2xl bg-[#FF9457] px-7 text-base font-semibold text-[#10152B] transition hover:brightness-110 disabled:opacity-50">Go</button>
              </form>
            )}
          </>
        )}
        <div className="mt-4 min-h-[24px]" aria-live="polite">
          {feedback && <p className={cx('flex items-center gap-1.5 text-sm font-medium', feedback.ok ? 'text-[#6FCF97]' : 'text-[#FF8F8F]')}>{feedback.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{feedback.text}</p>}
        </div>
      </div>
    </motion.div>
  )
}

function Summary({ summary, onClose }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto w-full max-w-md rounded-3xl border border-white/15 bg-white/[.08] p-8 text-center shadow-2xl backdrop-blur-xl">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }} className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[#6FCF97]/20 text-[#6FCF97]"><CheckCircle2 className="h-9 w-9" /></motion.div>
      <h2 className="font-display text-3xl text-white">You're up!</h2>
      <p className="mt-1 text-sm text-white/65">{summary.label} dismissed{summary.practice ? ' (test — not counted)' : ''}</p>
      {summary.alertness_score != null && <div className="mt-6 flex justify-center"><ScoreRing value={summary.alertness_score} size={140} label="Alertness" /></div>}
      <div className="mt-6 grid grid-cols-3 gap-3 text-white">
        {[['Time', `${summary.seconds_to_dismiss}s`], ['Wrong', summary.wrong_answers], ['Snoozes', summary.snoozes]].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white/10 py-3"><div className="num text-xl font-semibold">{v}</div><div className="text-[11px] uppercase tracking-wider text-white/55">{k}</div></div>
        ))}
      </div>
      <Button size="lg" className="mt-7 w-full" onClick={onClose}>Start my day</Button>
    </motion.div>
  )
}

export default function RingOverlay() {
  const { session, summary, soundBlocked, applyAnswer, snooze, cancelTest, enableSound, clearSummary } = useAlarm()
  const now = useNow()
  const [err, setErr] = useState('')
  const ringing = session?.status === 'ringing'
  const open = ringing || !!summary

  useEffect(() => {
    if (!open) return undefined
    const block = (e) => { if (e.key === 'Escape') e.preventDefault() }
    document.addEventListener('keydown', block)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', block); document.body.style.overflow = '' }
  }, [open])

  const doSnooze = async () => { setErr(''); try { await snooze() } catch (e) { setErr(errorMessage(e)) } }
  const left = session ? session.max_snoozes - session.snooze_count : 0
  const p = session?.progress

  return (
    <AnimatePresence>
      {open && (
        <motion.div role="dialog" aria-modal="true" aria-label="Alarm ringing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] overflow-y-auto text-white" style={{ background: 'linear-gradient(180deg,#0A0D1E 0%,#141A3A 45%,#3A2347 78%,#7A3B2E 100%)' }}>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'radial-gradient(60% 80% at 50% 110%,rgba(255,148,87,.5),transparent 70%)' }} />
          <div className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-5 py-8">
            {summary && !ringing ? <Summary summary={summary} onClose={clearSummary} /> : (
              <>
                <div className="mb-7 text-center">
                  <div className="relative mx-auto mb-4 grid h-20 w-20 place-items-center">
                    <span className="absolute inset-0 rounded-full bg-[#FF9457]/30 animate-pulseRing" />
                    <span className="absolute inset-0 rounded-full bg-[#FF9457]/20 animate-pulseRing [animation-delay:.9s]" />
                    <AlarmClock className="relative h-10 w-10 text-[#FF9457] animate-ring" />
                  </div>
                  <p className="num text-6xl font-semibold tracking-tight sm:text-7xl" style={{ textShadow: '0 0 50px rgba(255,148,87,.45)' }}>
                    {new Date(now).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </p>
                  <p className="mt-2 text-lg text-white/80">{session.label}</p>
                  {session.is_practice && <span className="mt-2 inline-block rounded-full bg-[#8C9EFF]/25 px-3 py-1 text-xs font-medium text-[#C5CFFF]">Test mode — not counted in your stats</span>}
                </div>

                <div className="mb-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-white/75">
                  <span className="inline-flex items-center gap-1.5"><Zap className="h-4 w-4 text-[#FF9457]" />{p.description}</span>
                  <span className="inline-flex items-center gap-1.5"><Flame className="h-4 w-4 text-[#FF9457]" />
                    {p.max_questions ? `Correct ${p.have}/${p.need} · question ${p.questions_asked + 1}/${p.max_questions}` : `Progress ${p.have}/${p.need}`}
                  </span>
                </div>
                <div className="mx-auto mb-6 flex gap-2">
                  {Array.from({ length: p.need }).map((_, i) => (
                    <span key={i} className={cx('h-2.5 w-10 rounded-full transition-all', i < p.have ? 'bg-[#6FCF97]' : 'bg-white/20')} />
                  ))}
                </div>

                {soundBlocked && (
                  <button onClick={enableSound} className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-[#FF9457] px-5 py-2.5 text-sm font-semibold text-[#10152B] shadow-lg">
                    <Volume2 className="h-4 w-4" />Tap to enable alarm sound
                  </button>
                )}

                <AnimatePresence mode="wait">
                  {session.challenge && <ChallengeCard key={session.challenge.id} session={session} onResult={applyAnswer} />}
                </AnimatePresence>

                <div className="mt-6 flex flex-col items-center gap-3">
                  {session.is_practice ? (
                    <Button variant="ghost" className="text-white/80 hover:bg-white/10 hover:text-white" icon={BellOff} onClick={cancelTest}>Cancel test</Button>
                  ) : session.max_snoozes > 0 ? (
                    <button onClick={doSnooze} disabled={left <= 0}
                      className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
                      <Moon className="h-4 w-4" />{left > 0 ? `Snooze ${session.snooze_minutes} min · ${left} left` : 'No snoozes left'}
                    </button>
                  ) : <p className="inline-flex items-center gap-1.5 text-xs text-white/55"><Clock className="h-3.5 w-3.5" />Snooze is disabled for this alarm</p>}
                  {left > 0 && !session.is_practice && session.max_snoozes > 0 && <p className="text-xs text-white/45">Snoozing makes your next challenge one level harder.</p>}
                  {err && <p className="text-sm text-[#FF8F8F]">{err}</p>}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
