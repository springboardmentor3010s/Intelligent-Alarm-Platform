import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  getAlarms,
  startAlarmSession,
  getChallenge,
  submitChallengeAnswer,
  expireAlarmSession,
  snoozeSession,
} from "../services/api";
import { showAlarmBrowserNotification } from "../services/notificationService";


const DIFFICULTY_TIME = {
  beginner: 30,
  easy: 30,
  medium: 30,
  hard: 30,
  expert: 30,
};


function getChallengeTime(difficulty) {
  return (
    DIFFICULTY_TIME[
      String(difficulty || "medium").toLowerCase()
    ] || 30
  );
}


function getChallengeLabel(type) {
  const labels = {
    math: "Math",
    logic: "Logic",
    memory: "Memory",
    word: "Word",
    pattern: "Pattern",
    riddle: "Riddle",
    quiz: "Quiz",
  };

  return (
    labels[
      String(type || "math").toLowerCase()
    ] || "Math"
  );
}


function getDifficultyLabel(difficulty) {
  const labels = {
    beginner: "Beginner",
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    expert: "Expert",
  };

  return (
    labels[
      String(difficulty || "medium").toLowerCase()
    ] || "Medium"
  );
}


function normalizeTime(time) {
  if (!time) {
    return "--:--";
  }

  if (typeof time === "string") {
    return time.substring(0, 5);
  }

  return "--:--";
}

function CognitiveAlarm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const alarmIdParam = searchParams.get("alarmId");
  const deepLinkHandled = useRef(null);

  // =====================================================
  // STATE
  // =====================================================

  const [alarms, setAlarms] = useState([]);
  const [selectedAlarm, setSelectedAlarm] = useState(null);
  const [session, setSession] = useState(null);
  const [challenge, setChallenge] = useState(null);

  const [answer, setAnswer] = useState("");

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const [snoozeFeedback, setSnoozeFeedback] = useState("");

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // Challenge timer
  const [challengeTime, setChallengeTime] = useState(30);
  const [timeExpired, setTimeExpired] = useState(false);

  // Memory challenge
  const [showMemory, setShowMemory] = useState(true);

  // Alarm sound
  const [soundEnabled, setSoundEnabled] = useState(
    localStorage.getItem("alarm_sound_enabled") === "true"
  );

  const [alarmRinging, setAlarmRinging] = useState(false);

  // Notifications
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );

  // Audio
  const audioRef = useRef(null);

  // Prevent same alarm from triggering repeatedly
  const triggeredAlarms = useRef(new Set());


  // =====================================================
  // CHALLENGE TYPE
  // =====================================================

  const isMemoryChallenge =
    challenge?.challenge_type?.toLowerCase() === "memory";


  // =====================================================
  // LOAD ALARMS
  // =====================================================

  useEffect(() => {
    loadAlarms();
  }, []);

  // Deep-link auto-activation: /cognitive-alarm?alarmId=<id>
  useEffect(() => {
    if (loading || !alarms.length) return;

    if (alarmIdParam) {
      const targetId = Number(alarmIdParam);
      if (deepLinkHandled.current === targetId) return;

      const matched = alarms.find((a) => a.id === targetId);
      if (matched) {
        deepLinkHandled.current = targetId;
        startAlarm(matched);
      } else {
        setError(`Alarm #${alarmIdParam} not found or unauthorized.`);
      }
    }
  }, [loading, alarms, alarmIdParam]);



  async function loadAlarms() {
    try {
      setLoading(true);
      setError("");

      const data = await getAlarms();

      if (Array.isArray(data)) {
        setAlarms(data);
      } else if (Array.isArray(data?.alarms)) {
        setAlarms(data.alarms);
      } else {
        setAlarms([]);
      }
    } catch (error) {
      console.error("Failed to load alarms:", error);
      setError(
        error.message || "Failed to load alarms"
      );
    } finally {
      setLoading(false);
    }
  }


  // =====================================================
  // CHALLENGE TIMER
  // =====================================================

  useEffect(() => {
    if (!challenge) {
      return;
    }

    if (result || timeExpired) {
      return;
    }

    const initialTime = getChallengeTime(
      challenge.difficulty
    );

    setChallengeTime(initialTime);

    const timer = setInterval(() => {
      setChallengeTime((currentTime) => {
        if (currentTime <= 1) {
  clearInterval(timer);

  setTimeExpired(true);

  setResult({
    correct: false,
    timeout: true,
  });

  stopAlarmSound();

  // Save timeout to backend
  if (session?.id) {
    expireAlarmSession(session.id)
      .then((expiredSession) => {
        setSession(expiredSession);
      })
      .catch((error) => {
        console.error(
          "Failed to save timeout session:",
          error
        );
      });
  }

  return 0;
}
        return currentTime - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [  challenge, 
        result,
        timeExpired, 
        session]);


  // =====================================================
  // ENABLE NOTIFICATIONS
  // =====================================================

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setError(
        "This browser does not support notifications."
      );
      return;
    }

    try {
      const permission =
        await Notification.requestPermission();

      setNotificationPermission(permission);

      if (permission === "granted") {
        setError("");
        showAlarmBrowserNotification(
          { id: 0, name: "Notification Test" },
          () => window.focus()
        );
      } else {
        setError(
          "Notification permission was denied. Please allow notifications in your browser settings to receive real wake-up alerts."
        );
      }
    } catch (error) {
      setError(error.message);
    }
  }
  // =====================================================
  // SHOW NOTIFICATION
  // =====================================================

  function showAlarmNotification(alarm) {
    showAlarmBrowserNotification(alarm, () => {
      window.focus();
    });
  }



  // =====================================================
  // ENABLE ALARM SOUND
  // =====================================================

  async function enableAlarmSound() {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(
          "/alarm.mp3"
        );

        audioRef.current.loop = true;
        audioRef.current.volume = 1;
      }

      await audioRef.current.play();

      audioRef.current.pause();
      audioRef.current.currentTime = 0;

      localStorage.setItem(
        "alarm_sound_enabled",
        "true"
      );

      setSoundEnabled(true);
      setError("");
    } catch (error) {
      console.error("Audio error:", error);

      setError(
        "Unable to play alarm sound. Check alarm.mp3."
      );
    }
  }


  // =====================================================
  // START ALARM SOUND
  // =====================================================

  async function startAlarmSound() {
    try {
      if (!soundEnabled) {
        setAlarmRinging(true);
        return;
      }

      if (!audioRef.current) {
        audioRef.current = new Audio(
          "/alarm.mp3"
        );

        audioRef.current.loop = true;
        audioRef.current.volume = 1;
      }

      await audioRef.current.play();

      setAlarmRinging(true);
    } catch (error) {
      console.error(
        "Alarm sound error:",
        error
      );

      setError(
        "Alarm sound could not be played."
      );

      setAlarmRinging(true);
    }
  }


  // =====================================================
  // STOP ALARM SOUND
  // =====================================================

  function stopAlarmSound() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setAlarmRinging(false);
  }


  // =====================================================
  // START COGNITIVE ALARM
  // =====================================================

  async function startAlarm(alarm) {
    if (!alarm || !alarm.id) {
      setError("Invalid alarm.");
      return;
    }

    try {
      setStarting(true);
      setError("");

      setResult(null);
      setAnswer("");

      setChallenge(null);
      setTimeExpired(false);
      setChallengeTime(
        getChallengeTime(alarm.difficulty)
      );

      setShowMemory(true);

      setSelectedAlarm(alarm);

      // -------------------------------------------------
      // Start session.
      //
      // The backend reads:
      // alarm.challenge_type
      // alarm.difficulty
      //
      // Nothing is selected here.
      // -------------------------------------------------

      const sessionData =
        await startAlarmSession(alarm.id);

      setSession(sessionData);

      // -------------------------------------------------
      // Get the challenge created for this session.
      // -------------------------------------------------

      if (!sessionData?.challenge_id) {
        throw new Error(
          "No challenge was created for this session."
        );
      }

      const challengeData =
        await getChallenge(
          sessionData.challenge_id
        );

      setChallenge(challengeData);

      setAnswer("");
      setTimeExpired(false);

      // Make sure the alarm is visibly ringing.
      await startAlarmSound();

    } catch (error) {
      console.error(
        "Failed to start cognitive alarm:",
        error
      );

      setError(
        error.message ||
          "Failed to start cognitive alarm."
      );

      setSelectedAlarm(null);
      setSession(null);
      setChallenge(null);

      stopAlarmSound();
    } finally {
      setStarting(false);
    }
  }


  // =====================================================
  // SUBMIT ANSWER
  // =====================================================

  async function handleSubmit(event) {
    event.preventDefault();

    if (timeExpired) {
      return;
    }

    if (!answer.trim()) {
      setError("Please enter your answer.");
      return;
    }

    if (!challenge?.id) {
      setError("Challenge not found.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const data =
        await submitChallengeAnswer(
          challenge.id,
          answer.trim()
        );

      setResult(data);

      // -------------------------------------------------
      // Update selected alarm with adaptive difficulty
      // -------------------------------------------------
      if (data?.adaptive_difficulty?.next_difficulty) {
        setSelectedAlarm((prev) =>
          prev
            ? { ...prev, difficulty: data.adaptive_difficulty.next_difficulty }
            : prev
        );
        loadAlarms();
      }

      // -------------------------------------------------
      // Correct
      // -------------------------------------------------

      if (data.correct) {
        stopAlarmSound();

        setSession((currentSession) => ({
          ...currentSession,
          session_status: "completed",
        }));

        return;
      }

      // -------------------------------------------------
      // Incorrect
      //
      // Backend has already completed the current
      // session. The Retry button therefore creates
      // a NEW session + NEW challenge.
      // -------------------------------------------------

      stopAlarmSound();

    } catch (error) {
      console.error(
        "Failed to submit answer:",
        error
      );

      setError(
        error.message ||
          "Failed to submit answer."
      );
    } finally {
      setSubmitting(false);
    }
  }


  // =====================================================
  // RETRY WITH A NEW CHALLENGE
  // =====================================================

  async function retryAnswer() {
    if (!selectedAlarm) {
      resetAlarm();
      return;
    }

    try {
      setStarting(true);
      setError("");

      setResult(null);
      setAnswer("");

      setChallenge(null);
      setTimeExpired(false);
      setShowMemory(true);

      setChallengeTime(
        getChallengeTime(
          selectedAlarm.difficulty
        )
      );

      // -----------------------------------------------
      // Start a NEW session.
      // Backend again uses the saved alarm
      // challenge_type + difficulty.
      // -----------------------------------------------

      const sessionData =
        await startAlarmSession(
          selectedAlarm.id
        );

      setSession(sessionData);

      if (!sessionData?.challenge_id) {
        throw new Error(
          "No challenge was created for the retry."
        );
      }

      const challengeData =
        await getChallenge(
          sessionData.challenge_id
        );

      setChallenge(challengeData);

      await startAlarmSound();

    } catch (error) {
      console.error(
        "Failed to retry challenge:",
        error
      );

      setError(
        error.message ||
          "Failed to start a new challenge."
      );
    } finally {
      setStarting(false);
    }
  }


  // =====================================================
  // SNOOZE SESSION (MILESTONE 3)
  // =====================================================

  async function handleSnooze() {
    if (!session?.id) {
      setError("Active session not found to snooze.");
      return;
    }

    if (snoozing || timeExpired || result) {
      return;
    }

    try {
      setSnoozing(true);
      setError("");
      setSnoozeFeedback("");

      const updatedSession = await snoozeSession(session.id);
      setSession(updatedSession);
      setSnoozeFeedback(
        `Alarm snoozed! Snooze count: ${updatedSession.snooze_count}`
      );

      setTimeout(() => {
        setSnoozeFeedback("");
      }, 4000);
    } catch (err) {
      console.error("Failed to snooze session:", err);
      setError(err.message || "Failed to snooze alarm.");
    } finally {
      setSnoozing(false);
    }
  }


  // =====================================================
  // RESET ALARM
  // =====================================================

  function resetAlarm() {
    stopAlarmSound();

    setSelectedAlarm(null);
    setSession(null);
    setChallenge(null);

    setAnswer("");

    setResult(null);
    setError("");
    setSnoozing(false);
    setSnoozeFeedback("");

    setTimeExpired(false);
    setChallengeTime(30);

    setShowMemory(true);
  }


  // =====================================================
  // MEMORY CHALLENGE
  // =====================================================

  useEffect(() => {
    if (!challenge) {
      setShowMemory(true);
      return;
    }

    if (!isMemoryChallenge) {
      setShowMemory(true);
      return;
    }

    setShowMemory(true);

    const timer = setTimeout(() => {
      setShowMemory(false);
    }, 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [challenge, isMemoryChallenge]);


  // =====================================================
  // AUTOMATIC ALARM MONITORING
  // =====================================================

  useEffect(() => {
    if (alarms.length === 0) {
      return;
    }

    const checkAlarmTime = async () => {
      // Don't trigger another alarm while current
      // cognitive session is running.
      if (
        selectedAlarm ||
        session ||
        starting ||
        result
      ) {
        return;
      }

      const now = new Date();

      const hours = String(
        now.getHours()
      ).padStart(2, "0");

      const minutes = String(
        now.getMinutes()
      ).padStart(2, "0");

      const currentTime =
        `${hours}:${minutes}`;

      const today =
        now.toDateString();

      const matchingAlarm =
        alarms.find((alarm) => {
          // Only active alarms
          if (!alarm.is_active) {
            return false;
          }

          // Alarm must have a time
          if (!alarm.alarm_time) {
            return false;
          }

          const alarmTime =
            alarm.alarm_time.slice(0, 5);

          if (alarmTime !== currentTime) {
            return false;
          }

          // Prevent duplicate triggering
          const triggerKey =
            `${alarm.id}-${today}`;

          if (
            triggeredAlarms.current.has(
              triggerKey
            )
          ) {
            return false;
          }

          triggeredAlarms.current.add(
            triggerKey
          );

          return true;
        });

      if (matchingAlarm) {
        await startAlarmSound();

        showAlarmNotification(
          matchingAlarm
        );

        await startAlarm(
          matchingAlarm
        );
      }
    };

    // Check immediately
    checkAlarmTime();

    // Check every second
    const interval = setInterval(
      checkAlarmTime,
      1000
    );

    return () => {
      clearInterval(interval);
    };
  }, [
    alarms,
    selectedAlarm,
    session,
    starting,
    result,
    soundEnabled,
  ]);


  // =====================================================
  // CLEANUP AUDIO
  // =====================================================

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);


  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="cognitive-alarm">
        <div className="loading">
          Loading alarms...
        </div>
      </div>
    );
  }


  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="cognitive-alarm">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="cognitive-header">

        <h1>
          🧠 Cognitive Alarm
        </h1>

        <p>
          Wake your mind before starting your day.
        </p>

        <div className="alarm-monitor">
          <span className="monitor-dot"></span>
          Alarm monitoring active
        </div>

        {/* Alarm Notifications Status & Settings Panel (Phase 14) */}
        <div
          className="alarm-notifications-panel"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            margin: "16px auto",
            maxWidth: "680px",
          }}
        >
          {notificationPermission === "granted" ? (
            <div
              className="sound-enabled"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                border: "1px solid #10b981",
                borderRadius: "20px",
                padding: "8px 16px",
                fontSize: "0.9rem",
                fontWeight: 600,
              }}
            >
              🔔 Notifications Enabled
            </div>
          ) : notificationPermission === "denied" ? (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                color: "#f87171",
                border: "1px solid #ef4444",
                borderRadius: "20px",
                padding: "8px 16px",
                fontSize: "0.85rem",
                fontWeight: 500,
              }}
            >
              ⚠️ Notifications Blocked — Allow in browser settings for wake-up alerts
            </div>
          ) : (
            <button
              type="button"
              className="enable-notification-button"
              onClick={enableNotifications}
            >
              🔔 Enable Notifications
            </button>
          )}

          {!soundEnabled ? (
            <button
              type="button"
              className="enable-sound-button"
              onClick={enableAlarmSound}
            >
              🔊 Enable Alarm Sound
            </button>
          ) : (
            <div
              className="sound-enabled"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(99, 102, 241, 0.15)",
                color: "#818cf8",
                border: "1px solid #6366f1",
                borderRadius: "20px",
                padding: "8px 16px",
                fontSize: "0.9rem",
                fontWeight: 600,
              }}
            >
              🔊 Sound Enabled
            </div>
          )}
        </div>

        <button
          className="back-dashboard-button"
          onClick={() =>
            navigate("/dashboard")
          }
        >
          ← Back to Dashboard
        </button>

        {/* Real Alarm Ringing Banner (Phase 5) */}
        {alarmRinging && selectedAlarm && (
          <div
            className="real-alarm-ringing-card"
            style={{
              background: "linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)",
              border: "2px solid #818cf8",
              borderRadius: "20px",
              padding: "24px",
              margin: "24px auto 12px",
              maxWidth: "640px",
              textAlign: "center",
              boxShadow: "0 0 35px rgba(99, 102, 241, 0.5)",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "8px" }}>⏰</div>
            <h2 style={{ fontSize: "1.8rem", margin: "0 0 8px", color: "#e0e7ff", fontWeight: 800 }}>
              Wake Up — Cognitive Challenge
            </h2>
            <p style={{ fontSize: "1.1rem", margin: "0 0 12px", color: "#c7d2fe" }}>
              Alarm <strong>'{selectedAlarm.name}'</strong> ({normalizeTime(selectedAlarm.alarm_time)}) is ringing!
            </p>
            <p style={{ fontSize: "0.95rem", color: "#a5b4fc", margin: 0 }}>
              Complete the {getChallengeLabel(selectedAlarm.challenge_type)} challenge below to dismiss the alarm.
            </p>
          </div>
        )}

      </div>


      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}


      {/* =================================================
          ALARM LIST
      ================================================= */}

      {!selectedAlarm &&
        !result && (

          <div className="alarm-list">

            <h2>
              My Alarms
            </h2>

            {alarms.length === 0 ? (

              <div className="empty-state">

                <h3>
                  No alarms found
                </h3>

                <p>
                  Create an alarm first.
                </p>

              </div>

            ) : (

              alarms.map((alarm) => (

                <div
                  className="alarm-card"
                  key={alarm.id}
                >

                  <div className="alarm-info">

                    <div>

                      <h3>
                        {alarm.name}
                      </h3>

                      <div className="alarm-time">
                        {normalizeTime(
                          alarm.alarm_time
                        )}
                      </div>

                      <p>
                        {alarm.alarm_type}
                        {" • "}
                        {alarm.repeat_pattern ||
                          "No repeat pattern"}
                      </p>

                      {/* Saved preference */}
                      <p>
                        🧠{" "}
                        {getChallengeLabel(
                          alarm.challenge_type
                        )}
                        {" • "}
                        {getDifficultyLabel(
                          alarm.difficulty
                        )}
                      </p>

                    </div>

                    <span
                      className={
                        alarm.is_active
                          ? "status active"
                          : "status inactive"
                      }
                    >
                      {alarm.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>

                  </div>

                  <button
                    className="start-cognitive-button"
                    onClick={() =>
                      startAlarm(alarm)
                    }
                    disabled={
                      starting ||
                      !alarm.is_active
                    }
                  >
                    {starting
                      ? "Starting..."
                      : "Start Cognitive Alarm"}
                  </button>

                </div>

              ))

            )}

          </div>

        )}


      {/* =================================================
          CHALLENGE
      ================================================= */}

      {selectedAlarm &&
        challenge &&
        !result && (

          <div className="challenge-box">

            {/* Selected Alarm */}

            <div className="selected-alarm">

              <div>

                <span>
                  Alarm
                </span>

                <strong>
                  {selectedAlarm.name}
                </strong>

              </div>

              <span>
                {normalizeTime(
                  selectedAlarm.alarm_time
                )}
              </span>

            </div>


            {/* Timer */}

            <div
              className={
                challengeTime <= 5
                  ? "challenge-timer timer-danger"
                  : "challenge-timer"
              }
            >

              <span>
                Time Remaining
              </span>

              <strong>
                {challengeTime}s
              </strong>

            </div>


            {/* Saved Challenge Type + Difficulty */}

            <div className="challenge-header">

              <span>
                🧠{" "}
                {getChallengeLabel(
                  challenge.challenge_type
                )}
              </span>

              <span>
                {getDifficultyLabel(
                  challenge.difficulty
                )}
              </span>

            </div>


            <h2>
              Cognitive Challenge
            </h2>


            {/* =================================================
                MEMORY CHALLENGE
            ================================================= */}

            {isMemoryChallenge ? (

              showMemory ? (

                <div className="memory-display">

                  <p>
                    Remember this sequence:
                  </p>

                  <div className="sequence">
                    {challenge.question}
                  </div>

                  <p>
                    You have 5 seconds to
                    remember it.
                  </p>

                </div>

              ) : (

                <div className="memory-hidden">

                  <h3>
                    Sequence Hidden
                  </h3>

                  <p>
                    Enter the sequence you
                    remembered.
                  </p>

                </div>

              )

            ) : (

              <div className="question-box">

                <h3>
                  {challenge.question}
                </h3>

              </div>

            )}


            {/* Answer Form */}

            <form
              onSubmit={handleSubmit}
            >

              <input
                type="text"
                placeholder="Enter your answer"
                value={answer}
                onChange={(event) =>
                  setAnswer(
                    event.target.value
                  )
                }
                autoFocus
              />

              <button
                type="submit"
                className="submit-answer-button"
                disabled={
                  submitting ||
                  timeExpired
                }
              >
                {submitting
                  ? "Checking..."
                  : "Submit Answer"}
              </button>

            </form>

            {/* =================================================
                SNOOZE CONTROLS (MILESTONE 3)
            ================================================= */}
            <div className="snooze-action-row">
              <div className="snooze-count-display">
                <span>Snooze count: <strong>{session?.snooze_count ?? 0}</strong></span>
              </div>

              <button
                type="button"
                className="snooze-alarm-button"
                onClick={handleSnooze}
                disabled={
                  snoozing ||
                  submitting ||
                  timeExpired
                }
              >
                {snoozing
                  ? "Snoozing..."
                  : "😴 Snooze (5 min)"}
              </button>
            </div>

            {snoozeFeedback && (
              <div className="snooze-feedback-alert">
                {snoozeFeedback}
              </div>
            )}

          </div>

        )}


      {/* =================================================
          RESULT
      ================================================= */}

      {result && (

        <div
          className={
            result.timeout
              ? "timeout-box"
              : result.correct
                ? "success-box"
                : "retry-box"
          }
        >

          {/* =================================================
              TIMEOUT
          ================================================= */}

          {result.timeout ? (

            <>

              <div className="result-icon">
                ⏰
              </div>

              <h2>
                Time's Up!
              </h2>

              <p>
                Your time has expired.
              </p>

              <p>
                The cognitive challenge
                was not completed within
                the allowed time.
              </p>

              <button
                className="finish-button"
                onClick={resetAlarm}
              >
                Finish
              </button>

            </>

          ) : result.correct ? (

            /* =================================================
               CORRECT
            ================================================= */

            <>

              <div className="result-icon">
                ✓
              </div>

              <h2>
                Correct Answer!
              </h2>

              <p>
                Your cognitive challenge
                has been completed.
              </p>

              <p>
                Session completed successfully.
              </p>

              {result.adaptive_difficulty && (
                <div
                  className="adaptive-difficulty-card"
                  style={{
                    margin: "18px auto 22px",
                    padding: "16px 20px",
                    borderRadius: "16px",
                    background: "rgba(10, 20, 42, 0.75)",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    maxWidth: "520px",
                    textAlign: "left",
                    boxShadow: "0 6px 24px rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "10px",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                      paddingBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontWeight: "700",
                        fontSize: "14px",
                        color: "#38bdf8",
                      }}
                    >
                      <span>🎯</span>
                      <span>Adaptive Difficulty Engine</span>
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        padding: "3px 10px",
                        borderRadius: "10px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        background:
                          result.adaptive_difficulty.decision === "increase"
                            ? "rgba(34, 197, 94, 0.15)"
                            : result.adaptive_difficulty.decision === "decrease"
                            ? "rgba(239, 68, 68, 0.15)"
                            : "rgba(245, 158, 11, 0.15)",
                        color:
                          result.adaptive_difficulty.decision === "increase"
                            ? "#4ade80"
                            : result.adaptive_difficulty.decision === "decrease"
                            ? "#f87171"
                            : "#fbbf24",
                        border: `1px solid ${
                          result.adaptive_difficulty.decision === "increase"
                            ? "rgba(34, 197, 94, 0.35)"
                            : result.adaptive_difficulty.decision === "decrease"
                            ? "rgba(239, 68, 68, 0.35)"
                            : "rgba(245, 158, 11, 0.35)"
                        }`,
                      }}
                    >
                      {result.adaptive_difficulty.decision === "increase"
                        ? "Level Up"
                        : result.adaptive_difficulty.decision === "decrease"
                        ? "Adjusted"
                        : "Maintained"}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: "700",
                      marginBottom: "12px",
                      color:
                        result.adaptive_difficulty.decision === "increase"
                          ? "#4ade80"
                          : result.adaptive_difficulty.decision === "decrease"
                          ? "#f87171"
                          : "#fbbf24",
                    }}
                  >
                    {result.adaptive_difficulty.reason || (
                      result.adaptive_difficulty.results?.length === 2 &&
                      result.adaptive_difficulty.results[0] === "correct" &&
                      result.adaptive_difficulty.results[1] === "correct"
                        ? "2/2 correct → Difficulty increased"
                        : result.adaptive_difficulty.results?.length === 2 &&
                          result.adaptive_difficulty.results.filter((r) => r === "correct").length === 1
                        ? "1/2 correct → Difficulty maintained"
                        : result.adaptive_difficulty.results?.length === 2 &&
                          result.adaptive_difficulty.results[0] === "incorrect" &&
                          result.adaptive_difficulty.results[1] === "incorrect"
                        ? "0/2 correct → Difficulty decreased"
                        : "Attempt evaluated → Difficulty maintained"
                    )}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      background: "rgba(0, 0, 0, 0.25)",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      marginBottom: "10px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#94a3b8",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          marginBottom: "4px",
                        }}
                      >
                        Evaluated Attempts
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {result.adaptive_difficulty.results &&
                        result.adaptive_difficulty.results.length > 0 ? (
                          result.adaptive_difficulty.results.map((res, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: "12px",
                                padding: "2px 8px",
                                borderRadius: "6px",
                                fontWeight: "600",
                                background:
                                  res === "correct"
                                    ? "rgba(34, 197, 94, 0.2)"
                                    : "rgba(239, 68, 68, 0.2)",
                                color: res === "correct" ? "#4ade80" : "#f87171",
                                border: `1px solid ${
                                  res === "correct"
                                    ? "rgba(34, 197, 94, 0.3)"
                                    : "rgba(239, 68, 68, 0.3)"
                                }`,
                              }}
                            >
                              {res === "correct" ? "✓ Correct" : "✕ Incorrect"}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                            1st attempt recorded
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#94a3b8",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          marginBottom: "4px",
                        }}
                      >
                        Next Challenge Level
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "13px", color: "#cbd5e1" }}>
                          {getDifficultyLabel(result.adaptive_difficulty.previous_difficulty)}
                        </span>
                        <span style={{ color: "#38bdf8", fontWeight: "700" }}>→</span>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: "800",
                            color:
                              result.adaptive_difficulty.decision === "increase"
                                ? "#38bdf8"
                                : result.adaptive_difficulty.decision === "decrease"
                                ? "#f87171"
                                : "#e2e8f0",
                            textTransform: "capitalize",
                          }}
                        >
                          {getDifficultyLabel(result.adaptive_difficulty.next_difficulty)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize: "11.5px",
                      color: "#94a3b8",
                      lineHeight: 1.4,
                    }}
                  >
                    Next cognitive challenge for this alarm will run at{" "}
                    <strong style={{ color: "#38bdf8" }}>
                      {getDifficultyLabel(result.adaptive_difficulty.next_difficulty)}
                    </strong>{" "}
                    difficulty.
                  </p>
                </div>
              )}

              <button
                className="finish-button"
                onClick={resetAlarm}
              >
                Finish
              </button>

            </>

          ) : (

            /* =================================================
               INCORRECT
            ================================================= */

            <>

              <div className="result-icon">
                ✕
              </div>

              <h2>
                Incorrect Answer
              </h2>

              <p>
                Don't worry. Try again.
              </p>

              {result.adaptive_difficulty && (
                <div
                  className="adaptive-difficulty-card"
                  style={{
                    margin: "18px auto 22px",
                    padding: "16px 20px",
                    borderRadius: "16px",
                    background: "rgba(10, 20, 42, 0.75)",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    maxWidth: "520px",
                    textAlign: "left",
                    boxShadow: "0 6px 24px rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "10px",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                      paddingBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontWeight: "700",
                        fontSize: "14px",
                        color: "#38bdf8",
                      }}
                    >
                      <span>🎯</span>
                      <span>Adaptive Difficulty Engine</span>
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        padding: "3px 10px",
                        borderRadius: "10px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        background:
                          result.adaptive_difficulty.decision === "increase"
                            ? "rgba(34, 197, 94, 0.15)"
                            : result.adaptive_difficulty.decision === "decrease"
                            ? "rgba(239, 68, 68, 0.15)"
                            : "rgba(245, 158, 11, 0.15)",
                        color:
                          result.adaptive_difficulty.decision === "increase"
                            ? "#4ade80"
                            : result.adaptive_difficulty.decision === "decrease"
                            ? "#f87171"
                            : "#fbbf24",
                        border: `1px solid ${
                          result.adaptive_difficulty.decision === "increase"
                            ? "rgba(34, 197, 94, 0.35)"
                            : result.adaptive_difficulty.decision === "decrease"
                            ? "rgba(239, 68, 68, 0.35)"
                            : "rgba(245, 158, 11, 0.35)"
                        }`,
                      }}
                    >
                      {result.adaptive_difficulty.decision === "increase"
                        ? "Level Up"
                        : result.adaptive_difficulty.decision === "decrease"
                        ? "Adjusted"
                        : "Maintained"}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: "700",
                      marginBottom: "12px",
                      color:
                        result.adaptive_difficulty.decision === "increase"
                          ? "#4ade80"
                          : result.adaptive_difficulty.decision === "decrease"
                          ? "#f87171"
                          : "#fbbf24",
                    }}
                  >
                    {result.adaptive_difficulty.reason || (
                      result.adaptive_difficulty.results?.length === 2 &&
                      result.adaptive_difficulty.results[0] === "correct" &&
                      result.adaptive_difficulty.results[1] === "correct"
                        ? "2/2 correct → Difficulty increased"
                        : result.adaptive_difficulty.results?.length === 2 &&
                          result.adaptive_difficulty.results.filter((r) => r === "correct").length === 1
                        ? "1/2 correct → Difficulty maintained"
                        : result.adaptive_difficulty.results?.length === 2 &&
                          result.adaptive_difficulty.results[0] === "incorrect" &&
                          result.adaptive_difficulty.results[1] === "incorrect"
                        ? "0/2 correct → Difficulty decreased"
                        : "Attempt evaluated → Difficulty maintained"
                    )}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      background: "rgba(0, 0, 0, 0.25)",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      marginBottom: "10px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#94a3b8",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          marginBottom: "4px",
                        }}
                      >
                        Evaluated Attempts
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {result.adaptive_difficulty.results &&
                        result.adaptive_difficulty.results.length > 0 ? (
                          result.adaptive_difficulty.results.map((res, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: "12px",
                                padding: "2px 8px",
                                borderRadius: "6px",
                                fontWeight: "600",
                                background:
                                  res === "correct"
                                    ? "rgba(34, 197, 94, 0.2)"
                                    : "rgba(239, 68, 68, 0.2)",
                                color: res === "correct" ? "#4ade80" : "#f87171",
                                border: `1px solid ${
                                  res === "correct"
                                    ? "rgba(34, 197, 94, 0.3)"
                                    : "rgba(239, 68, 68, 0.3)"
                                }`,
                              }}
                            >
                              {res === "correct" ? "✓ Correct" : "✕ Incorrect"}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                            1st attempt recorded
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#94a3b8",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          marginBottom: "4px",
                        }}
                      >
                        Next Challenge Level
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "13px", color: "#cbd5e1" }}>
                          {getDifficultyLabel(result.adaptive_difficulty.previous_difficulty)}
                        </span>
                        <span style={{ color: "#38bdf8", fontWeight: "700" }}>→</span>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: "800",
                            color:
                              result.adaptive_difficulty.decision === "increase"
                                ? "#38bdf8"
                                : result.adaptive_difficulty.decision === "decrease"
                                ? "#f87171"
                                : "#e2e8f0",
                            textTransform: "capitalize",
                          }}
                        >
                          {getDifficultyLabel(result.adaptive_difficulty.next_difficulty)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize: "11.5px",
                      color: "#94a3b8",
                      lineHeight: 1.4,
                    }}
                  >
                    Next cognitive challenge for this alarm will run at{" "}
                    <strong style={{ color: "#38bdf8" }}>
                      {getDifficultyLabel(result.adaptive_difficulty.next_difficulty)}
                    </strong>{" "}
                    difficulty.
                  </p>
                </div>
              )}

              <button
                className="retry-button"
                onClick={retryAnswer}
                disabled={starting}
              >
                {starting
                  ? "Generating..."
                  : "Try Again"}
              </button>

            </>

          )}

        </div>

      )}

    </div>
  );
}


export default CognitiveAlarm;