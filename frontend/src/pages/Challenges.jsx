import { useEffect, useState } from "react";
import "../App.css";
import { apiFetch } from "../api";
import { useAuth } from "../auth";
import { DIFFICULTIES, titleCase } from "../components/ui";

const CHALLENGE_TYPES = [
  { id: "math", icon: "∑", name: "Mathematical", text: "Solve mathematical problems." },
  { id: "logic", icon: "🧠", name: "Logical", text: "Solve logical reasoning problems." },
  { id: "memory", icon: "◉", name: "Memory", text: "Test your short-term memory." },
  { id: "word", icon: "Aa", name: "Word Games", text: "Play with meanings and words." },
  { id: "pattern", icon: "▦", name: "Pattern", text: "Find the next item in a pattern." },
  { id: "riddle", icon: "?", name: "Riddles", text: "Crack a short riddle." },
  { id: "quiz", icon: "✓", name: "Quick Quiz", text: "Answer a general knowledge question." },
];

function getMemoryDuration(difficulty) {
  if (difficulty === "beginner") return 6;
  if (difficulty === "easy") return 5;
  if (difficulty === "medium") return 4;
  if (difficulty === "hard") return 4;
  return 3;
}

function Challenges() {
  const { user } = useAuth();
  const [challengeType, setChallengeType] = useState("math");
  const [difficulty, setDifficulty] = useState("easy");

  const [challenge, setChallenge] = useState(null);
  const [answer, setAnswer] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const [startTime, setStartTime] = useState(null);

  // Memory challenge states
  const [memoryPhase, setMemoryPhase] = useState("idle");
  const [memoryTimeLeft, setMemoryTimeLeft] = useState(0);
  const [memoryDuration, setMemoryDuration] = useState(0);

  /*
   * Memory countdown
   *
   * memorizing → sequence visible
   * answering  → sequence hidden
   */
  useEffect(() => {
    if (memoryPhase !== "memorizing") {
      return;
    }

    if (memoryTimeLeft <= 0) {
      setMemoryPhase("answering");

      // Start response-time measurement only AFTER
      // the memorization period is finished.
      setStartTime(Date.now());

      return;
    }

    const timer = setTimeout(() => {
      setMemoryTimeLeft((previous) => previous - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [memoryPhase, memoryTimeLeft]);

  const generateChallenge = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    setAnswer("");
    setChallenge(null);

    setMemoryPhase("idle");
    setMemoryTimeLeft(0);
    setMemoryDuration(0);
    setStartTime(null);

    try {
      const data = await apiFetch("/challenges/generate", {
        method: "POST",
        body: {
          user_id: user.id,
          challenge_type: challengeType,
          difficulty: difficulty,
        },
      });

      setChallenge(data.challenge);

      // Special behavior for memory challenges
      if (data.challenge.challenge_type === "memory") {
        const duration = getMemoryDuration(data.challenge.difficulty);

        setMemoryDuration(duration);
        setMemoryTimeLeft(duration);
        setMemoryPhase("memorizing");
        setStartTime(null);
      } else {
        // Normal challenges start timing immediately
        setMemoryPhase("answering");
        setStartTime(Date.now());
      }
    } catch (error) {
      console.error(error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!challenge) {
      return;
    }

    if (memoryPhase === "memorizing") {
      setError("Please wait until the memory sequence is hidden.");
      return;
    }

    if (!answer.trim()) {
      setError("Please enter an answer.");
      return;
    }

    setSubmitting(true);
    setError("");
    setResult(null);

    const responseTime = startTime
      ? (Date.now() - startTime) / 1000
      : 0;

    try {
      const data = await apiFetch("/challenges/submit", {
        method: "POST",
        body: {
          challenge_id: challenge.id,
          user_id: user.id,
          answer: answer.trim(),
          response_time: Number(responseTime.toFixed(2)),
        },
      });

      setResult(data);
    } catch (error) {
      console.error(error);
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChallengeTypeChange = (type) => {
    setChallengeType(type);

    // Clear current challenge when switching type
    setChallenge(null);
    setAnswer("");
    setResult(null);
    setError("");

    setMemoryPhase("idle");
    setMemoryTimeLeft(0);
    setStartTime(null);
  };

  const handleDifficultyChange = (level) => {
    setDifficulty(level);

    // Clear current challenge when changing difficulty
    setChallenge(null);
    setAnswer("");
    setResult(null);
    setError("");

    setMemoryPhase("idle");
    setMemoryTimeLeft(0);
    setStartTime(null);
  };

  const isMemoryChallenge =
    challenge?.challenge_type === "memory";

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Cognitive Challenges</h1>
          <p>
            Test your cognitive skills before dismissing your alarm.
          </p>
        </div>
      </div>

      {/* Challenge Types */}
      <div className="challenge-type-grid">
        {CHALLENGE_TYPES.map((type) => (
          <button
            key={type.id}
            className={`challenge-type-card ${
              challengeType === type.id ? "active" : ""
            }`}
            onClick={() => handleChallengeTypeChange(type.id)}
          >
            <div className="challenge-icon">{type.icon}</div>
            <h3>{type.name}</h3>
            <p>{type.text}</p>
          </button>
        ))}
      </div>

      {/* Difficulty */}
      <div className="challenge-section">
        <h2>Difficulty Level</h2>

        <div className="difficulty-buttons">
          {DIFFICULTIES.map((level) => (
            <button
              key={level}
              className={
                difficulty === level
                  ? "difficulty-button active"
                  : "difficulty-button"
              }
              onClick={() => handleDifficultyChange(level)}
            >
              {titleCase(level)}
            </button>
          ))}
        </div>
      </div>

      {/* Generate */}
      <div className="challenge-action">
        <button
          className="generate-button"
          onClick={generateChallenge}
          disabled={loading}
        >
          {loading ? "Generating..." : "Generate Challenge"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="challenge-error">
          {error}
        </div>
      )}

      {/* Challenge */}
      {challenge && (
        <div className="challenge-question-card">

          <div className="challenge-question-header">
            <span>
              {challenge.challenge_type.toUpperCase()}
            </span>

            <span>
              {challenge.difficulty.toUpperCase()}
            </span>
          </div>

          {/* ================= MEMORY CHALLENGE ================= */}
          {isMemoryChallenge ? (
            <>
              {memoryPhase === "memorizing" ? (
                <div className="memory-memorizing">

                  <div className="memory-instruction">
                    <span className="memory-brain">🧠</span>

                    <h2>Memorize the sequence</h2>

                    <p>
                      Remember the sequence in the exact order.
                    </p>
                  </div>

                  <div className="memory-countdown">
                    <span>Time remaining</span>
                    <strong>
                      {memoryTimeLeft}s
                    </strong>
                  </div>

                  <div className="memory-progress-container">
                    <div
                      className="memory-progress-bar"
                      style={{
                        width: `${
                          (memoryTimeLeft / memoryDuration) * 100
                        }%`,
                      }}
                    />
                  </div>

                  <div className="memory-sequence">
                    {challenge.question}
                  </div>

                  <div className="memory-warning">
                    ⚡ Focus carefully — the sequence will disappear.
                  </div>
                </div>
              ) : (
                <div className="memory-answer-mode">

                  <div className="memory-hidden-icon">
                    🔒
                  </div>

                  <h2>What was the sequence?</h2>

                  <p>
                    The sequence is now hidden.
                    Enter it from memory in the same order.
                  </p>

                  <div className="memory-hidden-box">
                    <span>Sequence hidden</span>
                    <strong>••••••••</strong>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ================= NORMAL CHALLENGES ================= */
            <>
              <h2>{challenge.question}</h2>

              {challenge.options &&
                challenge.options.length > 0 && (
                  <div className="challenge-options">
                    {challenge.options.map(
                      (option, index) => (
                        <button
                          key={index}
                          onClick={() =>
                            setAnswer(option)
                          }
                          className={
                            answer === option
                              ? "option-button selected"
                              : "option-button"
                          }
                        >
                          {option}
                        </button>
                      )
                    )}
                  </div>
                )}
            </>
          )}

          {/* Answer section */}
          {memoryPhase !== "memorizing" && (
            <div className="answer-section">
              <input
                type="text"
                value={answer}
                onChange={(event) =>
                  setAnswer(event.target.value)
                }
                placeholder={
                  isMemoryChallenge
                    ? "Enter the sequence you remember"
                    : "Enter your answer"
                }
                disabled={submitting}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submitAnswer();
                  }
                }}
              />

              <button
                onClick={submitAnswer}
                disabled={submitting}
              >
                {submitting
                  ? "Checking..."
                  : "Submit Answer"}
              </button>
            </div>
          )}

          {/* Result */}
          {result && (
            <div
              className={
                result.correct
                  ? "challenge-result correct"
                  : "challenge-result incorrect"
              }
            >
              <strong>
                {result.correct
                  ? "✓ Correct!"
                  : "✗ Incorrect"}
              </strong>

              <p>{result.message}</p>

              <small>
                Attempt #{result.attempt_number}
              </small>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Challenges;