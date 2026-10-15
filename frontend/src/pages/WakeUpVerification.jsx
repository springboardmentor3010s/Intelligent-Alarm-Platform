import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../App.css";
import { apiFetch } from "../api";
import { useAuth } from "../auth";
import { CHALLENGE_LABELS, titleCase } from "../components/ui";

const HOLD_DURATION = 2000;
const MEMORY_SECONDS = 5;

function WakeUpVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const alarmId = location.state?.alarmId ?? null;

  const [methods, setMethods] = useState([]);
  const [method, setMethod] = useState("hold");
  const [alarm, setAlarm] = useState(null);

  // choose | starting | hold | confirm | challenge | checking | success | failed | error
  const [phase, setPhase] = useState("choose");
  const [verificationId, setVerificationId] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [responseTime, setResponseTime] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [snoozesLeft, setSnoozesLeft] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  // Challenge-based verification
  const [challenge, setChallenge] = useState(null);
  const [answer, setAnswer] = useState("");
  const [progress, setProgress] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [adaptiveNote, setAdaptiveNote] = useState("");
  const [memoryLeft, setMemoryLeft] = useState(0);
  const [busy, setBusy] = useState(false);

  const holdStartRef = useRef(null);
  const animationRef = useRef(null);
  const challengeStartRef = useRef(null);
  const startedAtRef = useRef(null);

  useEffect(() => {
    apiFetch("/wake-up-verification/methods")
      .then((data) => setMethods(data.methods))
      .catch(() => setMethods([]));

    if (alarmId) {
      apiFetch(`/alarms/${alarmId}`).then(setAlarm).catch(() => setAlarm(null));
      if (location.state && "snoozesLeft" in location.state) {
        // Came from the ringing screen, which already recorded the ring.
        setSnoozesLeft(location.state.snoozesLeft);
      } else {
        apiFetch(`/alarms/${alarmId}/trigger`, { method: "POST" })
          .then((data) => setSnoozesLeft(data.snoozes_remaining))
          .catch(() => {});
      }
    }
    return () => animationRef.current && cancelAnimationFrame(animationRef.current);
  }, []);

  // Memory challenges show their sequence for a few seconds.
  useEffect(() => {
    if (memoryLeft <= 0) return undefined;
    const timer = setTimeout(() => {
      setMemoryLeft((value) => {
        if (value - 1 <= 0) challengeStartRef.current = Date.now();
        return value - 1;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [memoryLeft]);

  const isChallengeMethod = (id) => id !== "hold" && id !== "confirmation";

  const begin = async () => {
    setError("");
    setNotice("");
    setPhase("starting");
    try {
      const data = await apiFetch("/wake-up-verification/start", {
        method: "POST",
        body: { user_id: user.id, alarm_id: alarmId, verification_method: method },
      });
      setVerificationId(data.verification_id);
      startedAtRef.current = Date.now();
      setHoldProgress(0);
      if (method === "hold") setPhase("hold");
      else if (method === "confirmation") setPhase("confirm");
      else {
        setPhase("challenge");
        await nextChallenge();
      }
    } catch (err) {
      setError(err.message);
      setPhase("error");
    }
  };

  const nextChallenge = async () => {
    setBusy(true);
    setAnswer("");
    setLastResult(null);
    try {
      const data = await apiFetch("/challenges/generate", {
        method: "POST",
        body: {
          user_id: user.id,
          challenge_type: alarm?.challenge_type || "math",
          // No difficulty is sent: the server chooses it from your
          // recent performance.
        },
      });
      setChallenge(data.challenge);
      setAdaptiveNote(data.adaptive?.reason || "");
      if (data.challenge.challenge_type === "memory") {
        challengeStartRef.current = null;
        setMemoryLeft(MEMORY_SECONDS);
      } else {
        setMemoryLeft(0);
        challengeStartRef.current = Date.now();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const finish = async (successful, seconds) => {
    setPhase("checking");
    setResponseTime(seconds);
    try {
      const data = await apiFetch("/wake-up-verification/complete", {
        method: "POST",
        body: {
          verification_id: verificationId,
          successful,
          response_time: Number(seconds.toFixed(2)),
        },
      });
      if (data.status === "in_progress") {
        // Not enough correct answers yet: keep going.
        setNotice(data.message);
        setPhase("challenge");
        await nextChallenge();
        return;
      }
      setPhase(data.successful ? "success" : "failed");
    } catch (err) {
      setError(err.message);
      setPhase("error");
    }
  };

  const submitChallenge = async () => {
    if (!answer.trim() || !challenge || memoryLeft > 0) return;
    setBusy(true);
    setError("");
    const seconds = challengeStartRef.current
      ? (Date.now() - challengeStartRef.current) / 1000
      : 0;
    try {
      const result = await apiFetch("/challenges/submit", {
        method: "POST",
        body: {
          challenge_id: challenge.id,
          user_id: user.id,
          answer: answer.trim(),
          response_time: Number(seconds.toFixed(2)),
        },
      });
      setLastResult(result);

      const status = await apiFetch(`/wake-up-verification/status/${verificationId}`);
      setProgress(status);
      if (status.satisfied) {
        await finish(true, (Date.now() - startedAtRef.current) / 1000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const giveUp = () => finish(false, (Date.now() - startedAtRef.current) / 1000);

  // ----- Hold button -----
  const updateHoldProgress = () => {
    if (!holdStartRef.current) return;
    const elapsed = performance.now() - holdStartRef.current;
    const value = Math.min((elapsed / HOLD_DURATION) * 100, 100);
    setHoldProgress(value);
    if (value >= 100) {
      finishHold();
      return;
    }
    animationRef.current = requestAnimationFrame(updateHoldProgress);
  };

  const startHold = () => {
    if (phase !== "hold") return;
    setError("");
    setHoldProgress(0);
    holdStartRef.current = performance.now();
    animationRef.current = requestAnimationFrame(updateHoldProgress);
  };

  const cancelHold = () => {
    if (phase !== "hold") return;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    holdStartRef.current = null;
    setHoldProgress(0);
  };

  const finishHold = async () => {
    if (!holdStartRef.current || !verificationId) return;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    const elapsed = (performance.now() - holdStartRef.current) / 1000;
    holdStartRef.current = null;
    setHoldProgress(100);
    await finish(true, elapsed);
  };

  // ----- Snooze and dismiss -----
  const snooze = async () => {
    setError("");
    try {
      const data = await apiFetch(`/alarms/${alarmId}/snooze`, { method: "POST" });
      setSnoozesLeft(data.snoozes_remaining);
      setNotice(`Snoozed for ${data.snooze_minutes} minutes. ${data.snoozes_remaining} snoozes left today.`);
    } catch (err) {
      setSnoozesLeft(0);
      setError(err.message);
    }
  };

  const dismiss = async () => {
    setError("");
    try {
      await apiFetch(`/alarms/${alarmId}/dismiss`, {
        method: "POST",
        body: { verification_id: verificationId },
      });
      setDismissed(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const retry = () => {
    setHoldProgress(0);
    setResponseTime(null);
    setProgress(null);
    setChallenge(null);
    setError("");
    setNotice("");
    setPhase("choose");
  };

  const chosen = methods.find((item) => item.id === method);

  return (
    <div className="page-container wake-verification-page">
      <div className="page-header">
        <div>
          <h1>Wake-Up Verification</h1>
          <p>
            {alarm
              ? `${alarm.title} is ringing. Confirm you are awake to dismiss it.`
              : "Complete this quick verification to confirm that you are awake."}
          </p>
        </div>
      </div>

      <div className="verification-wrapper">
        <div className="verification-card">
          {phase === "choose" && (
            <div className="verification-state">
              <div className="verification-icon">🔐</div>
              <h2>Choose how to verify</h2>
              <p>{chosen ? chosen.description : "Pick a verification method."}</p>

              <div className="challenge-options">
                {methods.map((item) => (
                  <button
                    key={item.id}
                    className={method === item.id ? "option-button selected" : "option-button"}
                    onClick={() => setMethod(item.id)}
                  >
                    {titleCase(item.id)}
                  </button>
                ))}
              </div>

              <button className="verification-primary-button" onClick={begin}>
                Start verification
              </button>

              {alarmId && (
                <button
                  className="small-button"
                  style={{ marginTop: 14 }}
                  onClick={snooze}
                  disabled={snoozesLeft === 0}
                >
                  {snoozesLeft === 0
                    ? "No snoozes left"
                    : `Snooze 5 min${snoozesLeft !== null ? ` (${snoozesLeft} left)` : ""}`}
                </button>
              )}
              {notice && <div className="notice-box">{notice}</div>}
              {error && <div className="challenge-error">{error}</div>}
            </div>
          )}

          {phase === "starting" && (
            <div className="verification-state">
              <div className="verification-icon loading-icon">⏳</div>
              <h2>Preparing Verification</h2>
              <p>Setting up your wake-up verification session...</p>
            </div>
          )}

          {phase === "hold" && (
            <div className="verification-state">
              <div className="verification-icon">🔐</div>
              <span className="verification-badge">STEP 2 OF 2</span>
              <h2>Prove You're Awake</h2>
              <p>Press and hold the button until the circle is completely filled.</p>

              <div className="hold-progress-wrapper">
                <div className="hold-progress" style={{ width: `${holdProgress}%` }} />
              </div>

              <button
                className="hold-button"
                onMouseDown={startHold}
                onMouseUp={cancelHold}
                onMouseLeave={cancelHold}
                onTouchStart={startHold}
                onTouchEnd={cancelHold}
              >
                <span className="hold-button-icon">👆</span>
                <span>{holdProgress > 0 ? "Keep Holding..." : "Press & Hold"}</span>
              </button>

              <div className="verification-tip">
                <span>💡</span>
                <p>Stay awake and keep holding until verification is complete.</p>
              </div>
            </div>
          )}

          {phase === "confirm" && (
            <div className="verification-state">
              <div className="verification-icon">☀️</div>
              <h2>Are you awake?</h2>
              <p>Tap to confirm that you are up and ready.</p>
              <button
                className="verification-primary-button"
                onClick={() => finish(true, (Date.now() - startedAtRef.current) / 1000)}
              >
                I'm awake
              </button>
            </div>
          )}

          {phase === "challenge" && (
            <div className="verification-state">
              <span className="verification-badge">{titleCase(method).toUpperCase()}</span>
              <h2>{chosen?.description}</h2>
              {progress && (
                <p>
                  Progress: {progress.progress} of {progress.required}
                  {progress.accuracy_percent !== undefined
                    ? ` · accuracy ${progress.accuracy_percent}%`
                    : ""}
                </p>
              )}
              {notice && <div className="notice-box">{notice}</div>}

              {challenge && (
                <div className="challenge-question-card" style={{ width: "100%" }}>
                  <div className="challenge-question-header">
                    <span>{(CHALLENGE_LABELS[challenge.challenge_type] || "").toUpperCase()}</span>
                    <span>{challenge.difficulty.toUpperCase()}</span>
                  </div>

                  {adaptiveNote && (
                    <p className="rec-basis">Adaptive difficulty: {adaptiveNote}</p>
                  )}

                  {memoryLeft > 0 ? (
                    <div className="memory-memorizing">
                      <div className="memory-countdown">
                        <span>Memorize</span>
                        <strong>{memoryLeft}s</strong>
                      </div>
                      <div className="memory-sequence">{challenge.question}</div>
                    </div>
                  ) : (
                    <>
                      <h2>
                        {challenge.challenge_type === "memory"
                          ? "What was the sequence?"
                          : challenge.question}
                      </h2>

                      {challenge.options && challenge.options.length > 0 && (
                        <div className="challenge-options">
                          {challenge.options.map((option) => (
                            <button
                              key={option}
                              onClick={() => setAnswer(option)}
                              className={answer === option ? "option-button selected" : "option-button"}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="answer-section">
                        <input
                          type="text"
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          placeholder="Enter your answer"
                          disabled={busy || lastResult !== null}
                          onKeyDown={(e) => e.key === "Enter" && submitChallenge()}
                        />
                        <button onClick={submitChallenge} disabled={busy || lastResult !== null}>
                          {busy ? "Checking..." : "Submit Answer"}
                        </button>
                      </div>
                    </>
                  )}

                  {lastResult && (
                    <div className={lastResult.correct ? "challenge-result correct" : "challenge-result incorrect"}>
                      <strong>{lastResult.correct ? "✓ Correct!" : "✗ Incorrect"}</strong>
                      <p>{lastResult.message}</p>
                      <button className="small-button" onClick={nextChallenge}>
                        Next challenge
                      </button>
                    </div>
                  )}
                </div>
              )}

              {error && <div className="challenge-error">{error}</div>}
              <button className="small-button" onClick={giveUp} style={{ marginTop: 12 }}>
                Give up
              </button>
            </div>
          )}

          {phase === "checking" && (
            <div className="verification-state">
              <div className="verification-icon loading-icon">🔄</div>
              <h2>Verifying...</h2>
              <p>Checking your wake-up verification.</p>
              <div className="verification-spinner" />
            </div>
          )}

          {phase === "success" && (
            <div className="verification-state success-state">
              <div className="verification-icon success-icon">✓</div>
              <span className="verification-badge success-badge">VERIFIED</span>
              <h2>You're Awake! 🎉</h2>
              <p>
                {alarmId && !dismissed
                  ? "Verification complete. You can now dismiss your alarm."
                  : "Wake-up verification completed successfully."}
              </p>

              {responseTime !== null && (
                <div className="response-time-card">
                  <span>Verification time</span>
                  <strong>{responseTime.toFixed(2)}s</strong>
                </div>
              )}

              {alarmId && !dismissed && (
                <button className="verification-primary-button" onClick={dismiss}>
                  Dismiss alarm
                </button>
              )}
              {error && <div className="challenge-error">{error}</div>}
              {(dismissed || !alarmId) && (
                <button className="verification-primary-button" onClick={() => navigate("/dashboard")}>
                  Continue to Dashboard →
                </button>
              )}
            </div>
          )}

          {phase === "failed" && (
            <div className="verification-state">
              <div className="verification-icon failed-icon">✕</div>
              <h2>Verification Failed</h2>
              <p>We couldn't verify your wake-up. Please try again.</p>
              <button className="verification-primary-button" onClick={retry}>
                Try Again
              </button>
            </div>
          )}

          {phase === "error" && (
            <div className="verification-state">
              <div className="verification-icon failed-icon">!</div>
              <h2>Something Went Wrong</h2>
              <p>{error}</p>
              <button className="verification-primary-button" onClick={retry}>
                Retry Verification
              </button>
            </div>
          )}
        </div>

        <div className="verification-security-note">
          <span>🔒</span>
          <div>
            <strong>Why do I need to verify?</strong>
            <p>
              This extra step helps confirm that you are actually awake before your cognitive
              alarm is dismissed. Challenge-based checks are judged by the server from your
              recorded answers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WakeUpVerification;
