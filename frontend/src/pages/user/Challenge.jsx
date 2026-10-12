import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckCircle2, AlertCircle, RefreshCw,
  Volume2, VolumeX, Zap, Clock, AlertTriangle, Moon
} from "lucide-react";
import api from "../../services/api";
import { createAlarmEngine } from "../../utils/audioEngine";



/* ─── Role theme configs ─────────────────────────────────── */
const ROLE_THEMES = {
  DRILL_SERGEANT: {
    themeClass: "drill_sergeant",
    bg: "radial-gradient(ellipse at 50% 0%, rgba(127,29,29,0.85) 0%, rgba(15,23,42,0.97) 65%)",
    accent: "#ef4444", glow: "rgba(239,68,68,0.55)", pulseSpeed: "0.55s"
  },
  ZEN_GURU: {
    themeClass: "zen_guru",
    bg: "radial-gradient(ellipse at 50% 0%, rgba(6,78,59,0.75) 0%, rgba(15,23,42,0.97) 65%)",
    accent: "#10b981", glow: "rgba(16,185,129,0.45)", pulseSpeed: "2.2s"
  },
  CORPORATE_EXEC: {
    themeClass: "corporate_exec",
    bg: "radial-gradient(ellipse at 50% 0%, rgba(30,58,138,0.75) 0%, rgba(15,23,42,0.97) 65%)",
    accent: "#3b82f6", glow: "rgba(59,130,246,0.45)", pulseSpeed: "1.3s"
  },
  MAD_SCIENTIST: {
    themeClass: "mad_scientist",
    bg: "radial-gradient(ellipse at 50% 0%, rgba(59,7,100,0.85) 0%, rgba(15,23,42,0.97) 65%)",
    accent: "#a855f7", glow: "rgba(168,85,247,0.55)", pulseSpeed: "0.75s"
  },
  FITNESS_COACH: {
    themeClass: "fitness_coach",
    bg: "radial-gradient(ellipse at 50% 0%, rgba(69,26,3,0.85) 0%, rgba(15,23,42,0.97) 65%)",
    accent: "#f59e0b", glow: "rgba(245,158,11,0.55)", pulseSpeed: "0.85s"
  },
  STANDARD: {
    themeClass: "standard",
    bg: "radial-gradient(ellipse at 50% 0%, rgba(30,27,75,0.8) 0%, rgba(15,23,42,0.97) 65%)",
    accent: "#6366f1", glow: "rgba(99,102,241,0.45)", pulseSpeed: "1.6s"
  },
};


/* ─── Main Component ─────────────────────────────────────── */
function Challenge({ token, alarm, onDismiss, onSnooze, isPractice = false, practiceType = "MATH" }) {
  const [challenge, setChallenge] = useState(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(30);
  const [muted, setMuted] = useState(false);
  const [alarmActive, setAlarmActive] = useState(true);
  const [showVictory, setShowVictory] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [wrongShake, setWrongShake] = useState(false);
  const [solveTime, setSolveTime] = useState(0);
  const [solvedPuzzles, setSolvedPuzzles] = useState(0);
  const [memoryVisible, setMemoryVisible] = useState(false);

  const engineRef = useRef(null);
  const startedRef = useRef(false);
  const solveStart = useRef(Date.now());
  const memoryTimerRef = useRef(null);

  const roleKey = alarm?.alarm_role || "STANDARD";
  const theme = ROLE_THEMES[roleKey] || ROLE_THEMES.STANDARD;

  const requiredPuzzles = Math.max(1, alarm?.number_of_challenges || alarm?.puzzles_count || 1);
  const snoozeEnabled = alarm?.snooze_enabled ?? true;
  const isDrillSergeant = roleKey === "DRILL_SERGEANT";
  const isMandatory = !!alarm?.is_mandatory;
  const snoozeDuration = alarm?.snooze_duration || 5;
  const maxSnoozes = alarm?.max_snoozes !== undefined ? alarm.max_snoozes : 2;
  const canSnooze = snoozeEnabled && !isDrillSergeant && !isMandatory && maxSnoozes > 0;

  /* ── Start alarm audio on mount ─────────────────────────── */
  useEffect(() => {
    if (isPractice) return;
    engineRef.current = createAlarmEngine();
    // Attempt to start immediately; browsers may require a gesture first
    const tryStart = () => {
      engineRef.current.start(roleKey);
      startedRef.current = true;
    };
    // Try right away — works if user already interacted with the page
    tryStart();
    // Also attach a one-time gesture listener so audio resumes even if suspended
    const onGesture = () => {
      if (!startedRef.current || engineRef.current?.isRunning === false) {
        engineRef.current = createAlarmEngine();
        engineRef.current.start(roleKey);
        startedRef.current = true;
      }
    };
    window.addEventListener("click", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });
    window.addEventListener("touchstart", onGesture, { once: true });
    return () => {
      engineRef.current?.stop();
      window.removeEventListener("click", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("touchstart", onGesture);
    };
  }, [isPractice, roleKey]);

  /* ── Mute/unmute ─────────────────────────────────────────── */
  const toggleMute = useCallback(() => {
    setMuted(prev => {
      if (!prev) {
        engineRef.current?.stop();
        startedRef.current = false;
      } else {
        engineRef.current = createAlarmEngine();
        engineRef.current.start(roleKey);
        startedRef.current = true;
      }
      return !prev;
    });
  }, [roleKey]);

  /* ── Snooze Handler ──────────────────────────────────────── */
  const handleSnooze = () => {
    engineRef.current?.stop();
    startedRef.current = false;
    setAlarmActive(false);
    if (onSnooze) {
      onSnooze({ alarm, durationMinutes: snoozeDuration });
    }
  };

  /* ── Fetch challenge ─────────────────────────────────────── */
  // isNewSession=true resets puzzle progress (called on initial load only)
  const fetchRoleChallenge = async (isNewSession = false) => {
    try {
      setLoading(true);
      setResult(null);
      setAnswer("");
      setError("");
      setAttempts(0);
      if (isNewSession) {
        setSolvedPuzzles(0);
      }
      solveStart.current = Date.now();
      if (memoryTimerRef.current) clearTimeout(memoryTimerRef.current);

      const cType = isPractice ? practiceType : (alarm?.challenge_type || "MATH");
      const res = await api.post(
        `/challenges/generate?alarm_role=${roleKey}&difficulty=${alarm?.difficulty || "MEDIUM"}&challenge_type=${cType}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setChallenge(res.data);
      setTimer(res.data.time_limit || 30);

      if (res.data.type === "MEMORY") {
        setMemoryVisible(true);
        memoryTimerRef.current = setTimeout(() => {
          setMemoryVisible(false);
        }, (res.data.display_time || 5) * 1000);
      } else {
        setMemoryVisible(false);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load cognitive challenge. Try refreshing.");
    } finally {
      setLoading(false);
    }
  };

  // On alarm change, start a fresh session (resets puzzle count)
  useEffect(() => { fetchRoleChallenge(true); }, [alarm]);

  /* ── Countdown ───────────────────────────────────────────── */
  useEffect(() => {
    if (!challenge || result?.correct || timer <= 0) return;
    const interval = setInterval(() => setTimer(p => p - 1), 1000);
    return () => clearInterval(interval);
  }, [challenge, result, timer]);

  /* ── Timer expired: auto-refresh (keeps puzzle progress) ────────────────────────── */
  useEffect(() => {
    if (timer === 0 && challenge && !result?.correct) {
      const t = setTimeout(() => fetchRoleChallenge(false), 1200); // false = keep progress
      return () => clearTimeout(t);
    }
  }, [timer]);

  /* ── Submit ──────────────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!challenge || !answer.trim() || loading || result?.correct) return;

    try {
      setLoading(true);
      setAttempts(a => a + 1);
      const responseTime = Math.max(1, Math.round((Date.now() - solveStart.current) / 1000));

      const res = await api.post(
        `/challenges/${challenge.id}/submit`,
        { answer: answer.trim(), response_time: responseTime },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setResult(res.data);

      if (res.data.correct) {
        const nextSolved = solvedPuzzles + 1;
        setSolvedPuzzles(nextSolved);

        if (nextSolved < requiredPuzzles) {
          setResult({
            correct: true,
            message: `🎉 Correct! (${nextSolved}/${requiredPuzzles} solved). Loading next math puzzle...`
          });
          setTimeout(() => {
            fetchRoleChallenge();
          }, 1200);
        } else {
          // STOP alarm immediately when all required puzzles are solved
          if (!isPractice) {
            engineRef.current?.stop();
            startedRef.current = false;
            setAlarmActive(false);
          }
          setSolveTime(responseTime);
          setShowVictory(true);
          setTimeout(() => { if (onDismiss) onDismiss(); }, 2800);
        }
      } else {
        setWrongShake(true);
        setTimeout(() => setWrongShake(false), 600);
        setAnswer("");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to submit answer.");
    } finally {
      setLoading(false);
    }
  };

  /* ── MCQ option click ────────────────────────────────────── */
  const handleOptionClick = (opt) => {
    if (result?.correct || loading) return;
    setAnswer(opt);
  };

  // Auto-submit when MCQ option selected
  useEffect(() => {
    if (answer && challenge?.options?.length > 0 && !result?.correct && !loading) {
      handleSubmit();
    }
  }, [answer]);

  const timerMax = challenge?.time_limit || 30;
  const timerPct = Math.max(0, (timer / timerMax) * 100);
  const timerCritical = timer <= 5;
  const timerWarning = timer <= 10;
  const timerColor = timerCritical ? "#ef4444" : timerWarning ? "#f59e0b" : theme.accent;

  /* ── Victory Screen ──────────────────────────────────────── */
  if (showVictory) {
    return (
      <div className="alarm-ring-overlay alarm-victory-overlay">
        <div className="alarm-victory-modal" style={{ textAlign: "center", maxWidth: 480, animation: "victoryPop 0.6s cubic-bezier(0.175,0.885,0.32,1.275)" }}>
          <div style={{
            width: 110, height: 110, borderRadius: "50%",
            background: "linear-gradient(135deg, #10b981, #059669)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 28px",
            boxShadow: "0 0 60px rgba(16,185,129,0.7), 0 0 120px rgba(16,185,129,0.3)"
          }}>
            <CheckCircle2 size={54} color="#fff" />
          </div>
          <h1 style={{
            fontSize: 38, fontWeight: 900, color: "#fff", margin: "0 0 12px",
            background: "linear-gradient(135deg, #34d399, #a7f3d0)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
          }}>
            {isPractice ? "PRACTICE COMPLETE!" : "ALARM DISMISSED!"}
          </h1>
          <p style={{ color: "#6ee7b7", fontSize: 18, marginBottom: 28 }}>
            🎉 Your mind is awake. Have a great day!
          </p>
          <div className="alarm-victory-stats" style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{
              background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: 14, padding: "12px 22px", color: "#6ee7b7", fontWeight: 700
            }}>🧮 {requiredPuzzles} Puzzle{requiredPuzzles !== 1 ? "s" : ""} Solved</div>
            <div style={{
              background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: 14, padding: "12px 22px", color: "#6ee7b7", fontWeight: 700
            }}>⏱️ {solveTime}s Solve Time</div>
            {/* Removed ML Model and Stability scores as requested */}
          </div>

        </div>
      </div>
    );
  }

  /* ── Main alarm challenge UI ─────────────────────────────── */
  return (
    <div className={isPractice ? "practice-overlay" : "alarm-ring-overlay"} style={{ background: theme.bg, minHeight: isPractice ? "100%" : "100vh" }}>

      {/* Pulsing outer ring while alarm active */}
      {!isPractice && alarmActive && (
        <div className="alarm-pulse-ring" style={{
          borderColor: theme.accent,
          animationDuration: theme.pulseSpeed,
        }} />
      )}

      <div className="alarm-challenge-content">

        {/* ── Top bar ────────────────────────────────────────── */}
        <div className="challenge-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, width: "100%", maxWidth: 660, flexWrap: "wrap", gap: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 18px",
            background: "rgba(255,255,255,0.06)", borderRadius: 30,
            border: `1px solid ${theme.accent}40`
          }}>
            <span style={{ fontSize: 22 }}>{challenge?.role_icon || "⏰"}</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: theme.accent, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 1 }}>
                {isPractice ? "PRACTICE MODE" : "ALARM RINGING"}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                {isPractice ? `${practiceType} PUZZLES` : (challenge?.role_name || roleKey)}
              </div>
            </div>
            {!isPractice && alarmActive && <span className="alarm-live-dot" />}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isPractice ? (
              <button
                onClick={() => { if (onDismiss) onDismiss(); }}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 30, padding: "8px 18px", color: "#fff",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 13
                }}
              >
                Quit Practice
              </button>
            ) : (
              <>
                {canSnooze ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fde047", background: "rgba(245, 158, 11, 0.15)", padding: "6px 12px", borderRadius: 20, border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                    💤 {maxSnoozes} Snooze{maxSnoozes !== 1 ? "s" : ""} Left
                  </span>
                ) : isDrillSergeant ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5", background: "rgba(239, 68, 68, 0.15)", padding: "6px 12px", borderRadius: 20, border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                    🎖️ Zero Snooze Policy
                  </span>
                ) : isMandatory ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5", background: "rgba(239, 68, 68, 0.15)", padding: "6px 12px", borderRadius: 20, border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                    🛡️ Mandatory Alarm
                  </span>
                ) : null}

                <button
                  onClick={toggleMute}
                  style={{
                    background: muted ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${muted ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.12)"}`,
                    borderRadius: 30, padding: "8px 18px", color: muted ? "#fca5a5" : "#94a3b8",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 13
                  }}
                >
                  {muted ? <><VolumeX size={15} /> Muted</> : <><Volume2 size={15} /> Mute</>}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Persona quote banner ──────────────────────────── */}
        {challenge && (
          <div
            className={`persona-quote-banner ${theme.themeClass}`}
            style={{
              maxWidth: 660, width: "100%", marginBottom: 20,
              animation: alarmActive ? `alarmQuotePulse ${theme.pulseSpeed} ease-in-out infinite` : "none"
            }}
          >
            <span style={{ fontSize: 28 }}>{challenge.role_icon || "🧠"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: 1.5, fontWeight: 800, marginBottom: 4 }}>
                {isPractice ? "PRACTICE" : challenge.type} CHALLENGE {isPractice ? "" : "— SOLVE TO DISMISS"}
              </div>
              <div style={{ fontSize: 14, fontStyle: "italic", lineHeight: 1.4 }}>
                "{challenge.quote || "Wake your brain to dismiss the alarm!"}"
              </div>
            </div>
          </div>
        )}

        {/* ── Challenge box ─────────────────────────────────── */}
        <div
          className={`challenge-box ${wrongShake ? "wrong-shake" : ""}`}
          style={{
            maxWidth: 660, width: "100%",
            border: `2px solid ${timerCritical ? "#ef4444" : theme.accent}45`,
            boxShadow: timerCritical
              ? "0 0 40px rgba(239,68,68,0.4), 0 0 80px rgba(239,68,68,0.15)"
              : `0 0 30px ${theme.glow}35`,
            transition: "border-color 0.3s, box-shadow 0.3s"
          }}
        >
          {loading && !challenge ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <RefreshCw className="spin" size={36} style={{ color: theme.accent }} />
              <p style={{ color: "#94a3b8", marginTop: 16 }}>Generating challenge...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <AlertTriangle size={36} color="#ef4444" style={{ marginBottom: 12 }} />
              <p style={{ color: "#fca5a5", marginBottom: 16 }}>{error}</p>
              <button className="primary-button" onClick={fetchRoleChallenge}>
                <RefreshCw size={16} /> Retry
              </button>
            </div>
          ) : challenge ? (
            <form onSubmit={handleSubmit}>

              {/* Timer bar */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span className={`role-card-badge role-pill-${theme.themeClass}`} style={{ fontSize: 12 }}>
                    {challenge.type} PUZZLE ({solvedPuzzles + 1}/{requiredPuzzles})
                  </span>
                  <span style={{
                    fontWeight: 900, fontSize: 18, color: timerColor,
                    display: "flex", alignItems: "center", gap: 6,
                    animation: timerCritical ? "timerFlash 0.3s ease-in-out infinite" : "none"
                  }}>
                    <Clock size={17} style={{ color: timerColor }} />
                    {timer}s
                  </span>
                </div>
                <div style={{ height: 7, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 4,
                    width: `${timerPct}%`,
                    background: timerCritical
                      ? "linear-gradient(90deg, #ef4444, #dc2626)"
                      : `linear-gradient(90deg, ${theme.accent}, ${theme.accent}99)`,
                    transition: "width 1s linear, background 0.3s",
                  }} />
                </div>
                {timer === 0 && (
                  <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 700, textAlign: "center", marginTop: 8 }}>
                    ⚠️ Time expired! Loading next challenge...
                  </div>
                )}
              </div>

              {/* Attempts badge */}
              {attempts > 0 && !result?.correct && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, fontSize: 13,
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: 8, padding: "6px 12px", marginBottom: 12, color: "#fca5a5"
                }}>
                  <AlertTriangle size={14} /> {attempts} wrong attempt{attempts !== 1 ? "s" : ""} — alarm keeps ringing until solved!
                </div>
              )}

              {/* Question */}
              <h2 className="challenge-question" style={{
                fontSize: "clamp(18px, 3vw, 26px)", lineHeight: 1.35,
                textShadow: `0 0 24px ${theme.glow}`
              }}>
                {challenge.question}
              </h2>

              {/* Puzzle-specific visual elements */}
              {challenge.type === "MEMORY" ? (
                <div style={{ textAlign: "center", margin: "20px 0", height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {memoryVisible ? (
                    <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: 8, color: "#fff" }}>
                      {challenge.memory_sequence}
                    </div>
                  ) : (
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#fca5a5" }}>
                      Sequence hidden! Now enter it below.
                    </div>
                  )}
                </div>
              ) : challenge.type === "COLOR_MATCH" ? (
                <div style={{ textAlign: "center", margin: "20px 0" }}>
                  <div style={{ fontSize: 50, fontWeight: 900, color: challenge.display_color, textTransform: "uppercase", letterSpacing: 2 }}>
                    {challenge.display_word}
                  </div>
                </div>
              ) : challenge.type === "WORD_SCRAMBLE" ? (
                <div style={{ textAlign: "center", margin: "20px 0" }}>
                  <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 4, color: "#cbd5e1", textTransform: "uppercase" }}>
                    {challenge.scrambled_word}
                  </div>
                  {challenge.hint && (
                    <div style={{ fontSize: 14, color: theme.accent, marginTop: 8, fontWeight: 600 }}>
                      Hint: {challenge.hint}
                    </div>
                  )}
                </div>
              ) : challenge.type === "SEQUENCE" ? (
                <div style={{ textAlign: "center", margin: "20px 0" }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: "#cbd5e1", letterSpacing: 2 }}>
                    {challenge.sequence?.join(", ")} , <span style={{ color: theme.accent }}>?</span>
                  </div>
                  {challenge.pattern_hint && (
                     <div style={{ fontSize: 14, color: theme.accent, marginTop: 8, fontWeight: 600 }}>
                       Hint: {challenge.pattern_hint}
                     </div>
                  )}
                </div>
              ) : null}

              {/* MCQ or text input */}
              {challenge.options && challenge.options.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  {challenge.options.map((opt, i) => (
                    <button
                      className={`challenge-option ${answer === opt ? "selected" : ""}`}
                      key={i} type="button"
                      disabled={loading || result?.correct}
                      onClick={() => handleOptionClick(opt)}
                      style={{
                        background: answer === opt ? `${theme.accent}22` : "rgba(255,255,255,0.05)",
                        border: `2px solid ${answer === opt ? theme.accent : "rgba(255,255,255,0.1)"}`,
                        borderRadius: 14, padding: "14px 12px",
                        cursor: result?.correct ? "not-allowed" : "pointer",
                        color: answer === opt ? "#fff" : "#cbd5e1",
                        fontSize: 17, fontWeight: 700,
                        transition: "all 0.15s ease",
                        boxShadow: answer === opt ? `0 0 18px ${theme.accent}45` : "none",
                        transform: answer === opt ? "scale(1.03)" : "scale(1)"
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  className="challenge-input"
                  placeholder="Type your answer and press Enter..."
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !loading && handleSubmit(e)}
                  autoFocus
                  disabled={result?.correct || (challenge.type === "MEMORY" && memoryVisible)}
                  style={{
                    borderColor: timerCritical ? "#ef4444" : `${theme.accent}60`,
                    boxShadow: timerCritical ? "0 0 0 3px rgba(239,68,68,0.2)" : "none",
                    opacity: (challenge.type === "MEMORY" && memoryVisible) ? 0.5 : 1
                  }}
                />
              )}

              {/* Result message */}
              {result && (
                <div style={{
                  margin: "14px 0", padding: "14px 18px", borderRadius: 12, fontWeight: 700, fontSize: 15,
                  background: result.correct ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)",
                  border: `1px solid ${result.correct ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.3)"}`,
                  color: result.correct ? "#6ee7b7" : "#fca5a5",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8
                }}>
                  {result.correct
                    ? <><CheckCircle2 size={20} /> {result.message || "Correct! Dismissing alarm..."}</>
                    : <><AlertCircle size={20} /> {result.message || "Wrong — try again!"}</>
                  }
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                {!isPractice && canSnooze && (
                  <button
                    type="button"
                    className="icon-button"
                    onClick={handleSnooze}
                    disabled={loading || result?.correct}
                    style={{
                      flex: 1,
                      minWidth: 140,
                      height: 50,
                      background: "rgba(245, 158, 11, 0.15)",
                      border: "1.5px solid rgba(245, 158, 11, 0.45)",
                      color: "#fde047",
                      fontWeight: 800,
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                    title={`Snooze for ${snoozeDuration} minutes`}
                  >
                    <Moon size={16} /> Snooze ({snoozeDuration}m)
                  </button>
                )}

                <button
                  type="button"
                  className="icon-button"
                  onClick={fetchRoleChallenge}
                  disabled={loading}
                  style={{ flex: 1, minWidth: 140, height: 50 }}
                  title="Get a new question"
                >
                  <RefreshCw size={16} /> New Question
                </button>

                {(!challenge.options || challenge.options.length === 0) && (
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={loading || result?.correct || !answer.trim()}
                    style={{
                      flex: 2,
                      minWidth: 180,
                      height: 50,
                      fontSize: 15,
                      fontWeight: 800,
                      background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
                      boxShadow: `0 4px 20px ${theme.glow}`,
                    }}
                  >
                    {loading
                      ? <RefreshCw className="spin" size={18} />
                      : <><Zap size={18} /> {isPractice ? "Submit Answer" : "Submit & Dismiss"}</>
                    }
                  </button>
                )}
              </div>
            </form>
          ) : null}
        </div>

        {/* ── Bottom hint ────────────────────────────────────── */}
        {challenge && !result?.correct && !showVictory && !isPractice && (
          <p style={{ color: "#475569", fontSize: 12, marginTop: 16, textAlign: "center" }}>
            🔔 The alarm will keep ringing until you solve the puzzle correctly.
          </p>
        )}
      </div>
    </div>
  );
}

export default Challenge;
