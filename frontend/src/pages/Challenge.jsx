import { useCallback, useEffect, useRef, useState } from "react";

import {
  generateChallenge,
  submitChallengeAnswer,
} from "../services/api";

function Challenge({
  alarm,
  onChallengeComplete,
  onBack,
}) {
  const [questions, setQuestions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [challengeDifficulty, setChallengeDifficulty] = useState("medium");
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [loading, setLoading] = useState(Boolean(alarm?.id));
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState(null);
  const [challengeFinished, setChallengeFinished] = useState(false);
  const [error, setError] = useState(
    alarm?.id ? "" : "Alarm information is missing."
  );

  const loadedAlarmRef = useRef(null);
  const loadRequestRef = useRef(0);
  const questionStartedAtRef = useRef(0);

  const loadChallenge = useCallback(async () => {
    const requestId = ++loadRequestRef.current;

    try {
      setLoading(true);
      setError("");
      setScore(null);
      setChallengeFinished(false);
      setAnswers({});
      setCurrentQuestion(0);
      setSessionId(null);

      const data = await generateChallenge(alarm.id);

      if (requestId !== loadRequestRef.current) {
        return;
      }

      if (!data || !data.questions || data.questions.length === 0) {
        throw new Error("No challenge questions were generated.");
      }

      setSessionId(data.session_id);
      setChallengeDifficulty(data.difficulty || alarm.difficulty || "medium");
      questionStartedAtRef.current = performance.now();
      setQuestions(data.questions);
    } catch (err) {
      if (requestId !== loadRequestRef.current) {
        return;
      }

      const detail =
        err.response?.data?.detail ??
        err.message ??
        "Unable to load challenge.";

      setError(
        typeof detail === "string" ? detail : JSON.stringify(detail)
      );
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, [alarm]);

  useEffect(() => {
    if (!alarm?.id || loadedAlarmRef.current === alarm.id) {
      return;
    }

    loadedAlarmRef.current = alarm.id;
    void loadChallenge();
  }, [alarm, loadChallenge]);

  function handleAnswerChange(event) {
    setAnswers({
      ...answers,
      [currentQuestion]: event.target.value,
    });
    setError("");
  }

  async function handleNext() {
    const currentAnswer = answers[currentQuestion]?.trim();

    if (!currentAnswer) {
      setError("Please enter your answer before proceeding.");
      return;
    }

    const question = questions[currentQuestion];
    if (!question) {
      setError("Question data not found.");
      return;
    }

    const nextAnswers = {
      ...answers,
      [currentQuestion]: currentAnswer,
    };
    setError("");
    setSubmitting(true);
    setAnswers(nextAnswers);

    try {
      const responseTimeSeconds = Math.max(
        0,
        (performance.now() - questionStartedAtRef.current) / 1000
      );
      const result = await submitChallengeAnswer(
        question.id,
        currentAnswer,
        responseTimeSeconds
      );

      const backendScore = Number.isFinite(Number(result?.score))
        ? Number(result.score)
        : null;

      if (currentQuestion === questions.length - 1) {
        setChallengeFinished(true);

        if (
          result?.challenge_completed ||
          backendScore === questions.length
        ) {
          setScore(questions.length);
        } else {
          setScore(backendScore !== null ? backendScore : 0);
        }
      } else {
        setChallengeFinished(false);
        setScore(null);
        questionStartedAtRef.current = performance.now();
        setCurrentQuestion((prev) => prev + 1);
      }
      setSubmitting(false);
    } catch (err) {
      setSubmitting(false);
      if (err.response?.data?.detail) {
        setError(
          typeof err.response.data.detail === "string"
            ? err.response.data.detail
            : JSON.stringify(err.response.data.detail)
        );
      } else {
        setError("Unable to submit answer. Please try again.");
      }
    }
  }

  async function handleDismiss() {
    setSubmitting(true);
    setError("");
    try {
      await onChallengeComplete(sessionId);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to complete the alarm."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (loading) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card-saas" style={{ textAlign: "center", maxWidth: 460 }}>
          <div className="auth-header-icon">🧠</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif" }}>
            Preparing Cognitive Challenge
          </h2>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 24 }}>
            Generating wake verification puzzle for {alarm?.title || "your alarm"}...
          </p>
          <div className="alert-box alert-info" style={{ justifyContent: "center" }}>
            <span>⏳ Initializing AI question engine...</span>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // INITIAL LOAD ERROR STATE
  // ============================================================
  if (error && questions.length === 0) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card-saas" style={{ textAlign: "center", maxWidth: 460 }}>
          <div className="auth-header-icon" style={{ background: "rgba(244, 63, 94, 0.2)", color: "#f43f5e" }}>
            ⚠️
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif" }}>
            Challenge Generation Error
          </h2>
          <div className="alert-box alert-error" style={{ marginBottom: 24 }}>
            {error}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                loadedAlarmRef.current = null;
                void loadChallenge();
              }}
            >
              🔄 Try Again
            </button>
            <button className="btn btn-secondary" onClick={onBack}>
              ← Back to Alarms
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // COMPLETED RESULT VIEW
  // ============================================================
  if (challengeFinished && score !== null) {
    const passed = score === questions.length;

    return (
      <div className="auth-wrapper">
        <div className="auth-card-saas" style={{ textAlign: "center", maxWidth: 500 }}>
          <div
            className="auth-header-icon"
            style={{
              background: passed ? "rgba(16, 185, 129, 0.2)" : "rgba(244, 63, 94, 0.2)",
              color: passed ? "#10b981" : "#f43f5e",
            }}
          >
            {passed ? "🎉" : "🧠"}
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 6, fontFamily: "'Space Grotesk', sans-serif" }}>
            {passed ? "Cognitive Verification Passed!" : "Verification Incomplete"}
          </h2>

          <p style={{ color: "#94a3b8", fontSize: 13.5, marginBottom: 20 }}>
            {passed
              ? "Your brain is awake and alert. You can now dismiss the alarm."
              : "Some answers were incorrect. You must solve all questions to verify alertness."}
          </p>

          <div
            style={{
              padding: "20px 24px",
              borderRadius: 14,
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8 }}>
              Final Accuracy Score
            </div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 44,
                fontWeight: 700,
                color: passed ? "#4ade80" : "#fb7185",
                margin: "4px 0",
              }}
            >
              {score} / {questions.length}
            </div>
            <span className={`badge ${passed ? "badge-active" : "badge-inactive"}`}>
              {passed ? "100% Cleared" : "Requires Retry"}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {passed ? (
              <button
                className="btn btn-primary btn-lg"
                onClick={handleDismiss}
                disabled={submitting}
              >
                {submitting ? "Completing Alarm..." : "✅ Complete & Dismiss Alarm"}
              </button>
            ) : (
              <button
                className="btn btn-primary btn-lg"
                onClick={() => {
                  loadedAlarmRef.current = null;
                  void loadChallenge();
                }}
              >
                🔄 Retry Challenge
              </button>
            )}

            <button className="btn btn-secondary" onClick={onBack}>
              ← Back to Alarms
            </button>
          </div>
          {error && <div className="alert-box alert-error" style={{ marginTop: 16 }}>{error}</div>}
        </div>
      </div>
    );
  }

  // ============================================================
  // ACTIVE QUESTION SCREEN
  // ============================================================
  const question = questions[currentQuestion];
  const progressPercent = Math.round(((currentQuestion + 1) / questions.length) * 100);

  return (
    <div className="auth-wrapper">
      <div className="auth-card-saas" style={{ maxWidth: 580 }}>
        {/* PROGRESS HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <span className="badge badge-primary">{alarm.challenge_type}</span>
            <span className="badge badge-cyan">{challengeDifficulty}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>
            Question {currentQuestion + 1} of {questions.length}
          </span>
        </div>

        {/* PROGRESS BAR */}
        <div
          style={{
            height: 6,
            borderRadius: 6,
            background: "rgba(255, 255, 255, 0.08)",
            overflow: "hidden",
            marginBottom: 26,
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              background: "linear-gradient(90deg, #6366f1, #06b6d4)",
              borderRadius: 6,
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* QUESTION DISPLAY */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 14,
            padding: "24px 20px",
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
            Solve to Wake Up
          </div>
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 22,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            {question?.question}
          </h2>
        </div>

        {/* ANSWER INPUT */}
        <div className="form-group">
          <label className="form-label">
            Your Answer:
            <span style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8" }}>Press Enter ↵ to submit</span>
          </label>
          <input
            className="form-input"
            style={{
              fontSize: 18,
              textAlign: "center",
              fontWeight: 600,
              letterSpacing: 0.5,
              padding: "14px 16px",
            }}
            type="text"
            placeholder="Type your answer here..."
            value={answers[currentQuestion] || ""}
            onChange={handleAnswerChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !submitting) {
                handleNext();
              }
            }}
            autoFocus
            disabled={submitting}
          />
        </div>

        {error && <div className="alert-box alert-error">⚠️ {error}</div>}

        {/* ACTION BUTTONS */}
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onBack}
            disabled={submitting}
          >
            ← Exit
          </button>

          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleNext}
            disabled={submitting}
          >
            {submitting
              ? "Verifying Answer..."
              : currentQuestion === questions.length - 1
              ? "Submit & Verify 🚀"
              : "Next Question →"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Challenge;