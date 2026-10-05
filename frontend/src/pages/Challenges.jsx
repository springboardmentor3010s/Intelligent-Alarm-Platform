import { useEffect, useState } from "react";

function Challenges() {
  const API_URL = "http://127.0.0.1:8000";
  const email = localStorage.getItem("email");

  // =====================================================
  // CHALLENGE DATA
  // =====================================================

  const challengeData = {
    Math: {
      Beginner: [
        { question: "What is 4 × 3?", answer: "12" },
        { question: "What is 5 + 7?", answer: "12" },
        { question: "What is 10 - 4?", answer: "6" },
        { question: "What is 6 × 2?", answer: "12" },
        { question: "What is 20 ÷ 4?", answer: "5" },
      ],
      Easy: [
        { question: "What is 15 + 27?", answer: "42" },
        { question: "What is 18 - 9?", answer: "9" },
        { question: "What is 7 × 8?", answer: "56" },
        { question: "What is 81 ÷ 9?", answer: "9" },
        { question: "What is 25 + 36?", answer: "61" },
      ],
      Medium: [
        { question: "What is 24 × 15?", answer: "360" },
        { question: "What is 125 + 375?", answer: "500" },
        { question: "What is 144 ÷ 12?", answer: "12" },
        { question: "What is 45 × 12?", answer: "540" },
        { question: "What is 250 - 87?", answer: "163" },
      ],
      Hard: [
        { question: "What is 125 × 16?", answer: "2000" },
        { question: "What is 345 × 12?", answer: "4140" },
        { question: "What is 999 - 456?", answer: "543" },
        { question: "What is 1440 ÷ 12?", answer: "120" },
        { question: "What is 75 × 24?", answer: "1800" },
      ],
      Expert: [
        { question: "What is 875 × 64?", answer: "56000" },
        { question: "What is 1248 × 75?", answer: "93600" },
        { question: "What is 9999 × 9?", answer: "89991" },
        { question: "What is 12345 + 67890?", answer: "80235" },
        { question: "What is 98765 - 43210?", answer: "55555" },
      ],
    },

    "Logic Puzzle": {
      Beginner: [
        { question: "What comes next: 2, 4, 6, 8, ?", answer: "10" },
        { question: "What comes next: 1, 2, 3, 4, ?", answer: "5" },
        { question: "What comes next: 5, 10, 15, 20, ?", answer: "25" },
        { question: "What comes next: 10, 20, 30, 40, ?", answer: "50" },
        { question: "What comes next: 3, 6, 9, 12, ?", answer: "15" },
      ],
      Easy: [
        { question: "What comes next: 3, 6, 9, 12, ?", answer: "15" },
        { question: "What comes next: 4, 8, 12, 16, ?", answer: "20" },
        { question: "What comes next: 10, 15, 20, 25, ?", answer: "30" },
        { question: "What comes next: 20, 30, 40, 50, ?", answer: "60" },
        { question: "What comes next: 2, 5, 8, 11, ?", answer: "14" },
      ],
      Medium: [
        { question: "What comes next: 3, 6, 12, 24, ?", answer: "48" },
        { question: "What comes next: 2, 4, 8, 16, ?", answer: "32" },
        { question: "What comes next: 5, 10, 20, 40, ?", answer: "80" },
        { question: "What comes next: 1, 3, 9, 27, ?", answer: "81" },
        { question: "What comes next: 4, 8, 16, 32, ?", answer: "64" },
      ],
      Hard: [
        { question: "What comes next: 2, 6, 12, 20, 30, ?", answer: "42" },
        { question: "What comes next: 1, 4, 9, 16, 25, ?", answer: "36" },
        { question: "What comes next: 3, 7, 13, 21, 31, ?", answer: "43" },
        { question: "What comes next: 2, 5, 10, 17, 26, ?", answer: "37" },
        { question: "What comes next: 1, 8, 27, 64, ?", answer: "125" },
      ],
      Expert: [
        { question: "What comes next: 3, 8, 15, 24, 35, ?", answer: "48" },
        { question: "What comes next: 2, 6, 12, 20, 30, 42, ?", answer: "56" },
        { question: "What comes next: 1, 5, 14, 30, 55, ?", answer: "91" },
        { question: "What comes next: 2, 12, 36, 80, 150, ?", answer: "252" },
        { question: "What comes next: 4, 9, 16, 25, 36, ?", answer: "49" },
      ],
    },

    Memory: {
      Beginner: [
        { question: "Remember this number: 123. What is the number?", answer: "123" },
        { question: "Remember this number: 456. What is the number?", answer: "456" },
        { question: "Remember this number: 789. What is the number?", answer: "789" },
        { question: "Remember this number: 246. What is the number?", answer: "246" },
        { question: "Remember this number: 135. What is the number?", answer: "135" },
      ],
      Easy: [
        { question: "Remember this number: 4827. What is the number?", answer: "4827" },
        { question: "Remember this number: 7319. What is the number?", answer: "7319" },
        { question: "Remember this number: 5642. What is the number?", answer: "5642" },
        { question: "Remember this number: 9183. What is the number?", answer: "9183" },
        { question: "Remember this number: 2754. What is the number?", answer: "2754" },
      ],
      Medium: [
        { question: "Remember this number: 73915. What is the number?", answer: "73915" },
        { question: "Remember this number: 48261. What is the number?", answer: "48261" },
        { question: "Remember this number: 91537. What is the number?", answer: "91537" },
        { question: "Remember this number: 62841. What is the number?", answer: "62841" },
        { question: "Remember this number: 35792. What is the number?", answer: "35792" },
      ],
      Hard: [
        { question: "Remember this number: 581642. What is the number?", answer: "581642" },
        { question: "Remember this number: 739251. What is the number?", answer: "739251" },
        { question: "Remember this number: 426817. What is the number?", answer: "426817" },
        { question: "Remember this number: 915364. What is the number?", answer: "915364" },
        { question: "Remember this number: 283746. What is the number?", answer: "283746" },
      ],
      Expert: [
        { question: "Remember this number: 9274158. What is the number?", answer: "9274158" },
        { question: "Remember this number: 6382917. What is the number?", answer: "6382917" },
        { question: "Remember this number: 5147392. What is the number?", answer: "5147392" },
        { question: "Remember this number: 8264519. What is the number?", answer: "8264519" },
        { question: "Remember this number: 3917284. What is the number?", answer: "3917284" },
      ],
    },

    "Word Game": {
      Beginner: [
        { question: "How many letters are in COGNIA?", answer: "6" },
        { question: "How many letters are in CAT?", answer: "3" },
        { question: "How many letters are in DOG?", answer: "3" },
        { question: "How many letters are in CODE?", answer: "4" },
        { question: "How many letters are in AI?", answer: "2" },
      ],
      Easy: [
        { question: "How many letters are in COMPUTER?", answer: "8" },
        { question: "How many letters are in SOFTWARE?", answer: "8" },
        { question: "How many letters are in PROGRAM?", answer: "7" },
        { question: "How many letters are in WEBSITE?", answer: "7" },
        { question: "How many letters are in PYTHON?", answer: "6" },
      ],
      Medium: [
        { question: "How many letters are in PROGRAMMING?", answer: "11" },
        { question: "How many letters are in JAVASCRIPT?", answer: "10" },
        { question: "How many letters are in ALGORITHM?", answer: "9" },
        { question: "How many letters are in DATABASE?", answer: "8" },
        { question: "How many letters are in COMPUTER?", answer: "8" },
      ],
      Hard: [
        { question: "How many letters are in ARTIFICIAL?", answer: "10" },
        { question: "How many letters are in INTELLIGENT?", answer: "11" },
        { question: "How many letters are in DEVELOPMENT?", answer: "11" },
        { question: "How many letters are in TECHNOLOGY?", answer: "10" },
        { question: "How many letters are in KNOWLEDGE?", answer: "9" },
      ],
      Expert: [
        { question: "How many letters are in INTELLIGENCE?", answer: "12" },
        { question: "How many letters are in PROGRAMMABILITY?", answer: "15" },
        { question: "How many letters are in CYBERSECURITY?", answer: "13" },
        { question: "How many letters are in IMPLEMENTATION?", answer: "14" },
        { question: "How many letters are in TRANSFORMATION?", answer: "14" },
      ],
    },

    "Pattern Recognition": {
      Beginner: [
        { question: "What comes next: 1, 3, 5, 7, ?", answer: "9" },
        { question: "What comes next: 2, 4, 6, 8, ?", answer: "10" },
        { question: "What comes next: 10, 20, 30, 40, ?", answer: "50" },
        { question: "What comes next: 5, 10, 15, 20, ?", answer: "25" },
        { question: "What comes next: 3, 6, 9, 12, ?", answer: "15" },
      ],
      Easy: [
        { question: "What comes next: 2, 4, 8, 16, ?", answer: "32" },
        { question: "What comes next: 5, 10, 20, 40, ?", answer: "80" },
        { question: "What comes next: 1, 2, 4, 8, ?", answer: "16" },
        { question: "What comes next: 3, 6, 12, 24, ?", answer: "48" },
        { question: "What comes next: 10, 20, 40, 80, ?", answer: "160" },
      ],
      Medium: [
        { question: "What comes next: 1, 4, 9, 16, ?", answer: "25" },
        { question: "What comes next: 2, 6, 12, 20, ?", answer: "30" },
        { question: "What comes next: 4, 9, 16, 25, ?", answer: "36" },
        { question: "What comes next: 1, 8, 27, 64, ?", answer: "125" },
        { question: "What comes next: 9, 16, 25, 36, ?", answer: "49" },
      ],
      Hard: [
        { question: "What comes next: 2, 6, 18, 54, ?", answer: "162" },
        { question: "What comes next: 3, 9, 27, 81, ?", answer: "243" },
        { question: "What comes next: 5, 15, 45, 135, ?", answer: "405" },
        { question: "What comes next: 4, 12, 36, 108, ?", answer: "324" },
        { question: "What comes next: 7, 21, 63, 189, ?", answer: "567" },
      ],
      Expert: [
        { question: "What comes next: 2, 6, 18, 54, 162, ?", answer: "486" },
        { question: "What comes next: 3, 12, 48, 192, ?", answer: "768" },
        { question: "What comes next: 5, 20, 80, 320, ?", answer: "1280" },
        { question: "What comes next: 7, 35, 175, 875, ?", answer: "4375" },
        { question: "What comes next: 4, 20, 100, 500, ?", answer: "2500" },
      ],
    },

    Riddle: {
      Beginner: [
        { question: "What has hands but cannot clap?", answer: "clock" },
        { question: "What has a face and two hands?", answer: "clock" },
        { question: "What has legs but cannot walk?", answer: "table" },
        { question: "What has a neck but no head?", answer: "bottle" },
        { question: "What has keys but no locks?", answer: "keyboard" },
      ],
      Easy: [
        { question: "What has keys but cannot open locks?", answer: "keyboard" },
        { question: "What gets wetter as it dries?", answer: "towel" },
        { question: "What has one eye but cannot see?", answer: "needle" },
        { question: "What has many teeth but cannot bite?", answer: "comb" },
        { question: "What has a thumb and four fingers but is not alive?", answer: "glove" },
      ],
      Medium: [
        { question: "What gets wetter as it dries?", answer: "towel" },
        { question: "What can travel around the world while staying in one corner?", answer: "stamp" },
        { question: "What has words but never speaks?", answer: "book" },
        { question: "What has a head and a tail but no body?", answer: "coin" },
        { question: "What has cities but no houses?", answer: "map" },
      ],
      Hard: [
        { question: "What has a head and a tail but no body?", answer: "coin" },
        { question: "What belongs to you but other people use it more than you?", answer: "name" },
        { question: "What can fill a room but takes no space?", answer: "light" },
        { question: "What disappears as soon as you say its name?", answer: "silence" },
        { question: "What has branches but no fruit, trunk, or leaves?", answer: "bank" },
      ],
      Expert: [
        { question: "I speak without a mouth and hear without ears. What am I?", answer: "echo" },
        { question: "I have no life, but I can die. What am I?", answer: "battery" },
        { question: "The more you take, the more you leave behind. What are they?", answer: "footsteps" },
        { question: "I am always in front of you but can never be seen. What am I?", answer: "future" },
        { question: "I have keys but no locks, space but no room, and you can enter but not go inside. What am I?", answer: "keyboard" },
      ],
    },

    "Quick Quiz": {
      Beginner: [
        { question: "How many days are there in a week?", answer: "7" },
        { question: "How many months are there in a year?", answer: "12" },
        { question: "How many hours are there in a day?", answer: "24" },
        { question: "How many minutes are there in an hour?", answer: "60" },
        { question: "How many seasons are commonly recognized?", answer: "4" },
      ],
      Easy: [
        { question: "How many months are there in a year?", answer: "12" },
        { question: "How many continents are there?", answer: "7" },
        { question: "How many colors are in a rainbow?", answer: "7" },
        { question: "How many sides does a triangle have?", answer: "3" },
        { question: "How many sides does a square have?", answer: "4" },
      ],
      Medium: [
        { question: "How many planets are in our Solar System?", answer: "8" },
        { question: "How many bones are in an adult human body?", answer: "206" },
        { question: "How many players are on a football team on the field?", answer: "11" },
        { question: "How many letters are in the English alphabet?", answer: "26" },
        { question: "How many degrees are in a right angle?", answer: "90" },
      ],
      Hard: [
        { question: "How many bones are in an adult human body?", answer: "206" },
        { question: "How many teeth does a normal adult usually have?", answer: "32" },
        { question: "How many keys are on a standard piano?", answer: "88" },
        { question: "How many bits are in one byte?", answer: "8" },
        { question: "How many chromosomes are in a typical human cell?", answer: "46" },
      ],
      Expert: [
        { question: "How many bits are there in one byte?", answer: "8" },
        { question: "How many bytes are in one kibibyte?", answer: "1024" },
        { question: "How many vertices does a cube have?", answer: "8" },
        { question: "How many edges does a cube have?", answer: "12" },
        { question: "How many degrees are in the sum of angles of a triangle?", answer: "180" },
      ],
    },
  };

  const challengeTypes = Object.keys(challengeData);

  const difficultyLevels = [
    "Beginner",
    "Easy",
    "Medium",
    "Hard",
    "Expert",
  ];

  // =====================================================
  // STATES
  // =====================================================

  const [type, setType] = useState("Math");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [questionIndex, setQuestionIndex] = useState(0);

  const [question, setQuestion] = useState(
    challengeData.Math.Beginner[0].question
  );

  const [correctAnswer, setCorrectAnswer] = useState(
    challengeData.Math.Beginner[0].answer
  );

  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [isCorrect, setIsCorrect] = useState(false);

  const [history, setHistory] = useState([]);

  const [recommendedDifficulty, setRecommendedDifficulty] =
    useState("Beginner");

  const [confidence, setConfidence] = useState(0);

  const [loading, setLoading] = useState(false);
  const [mlLoading, setMlLoading] = useState(true);

  // =====================================================
  // NORMALIZE ANSWER
  // =====================================================

  const normalizeAnswer = (value) => {
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  };

  // =====================================================
  // SET CHALLENGE
  // =====================================================

  const setChallenge = (
    selectedType,
    selectedDifficulty,
    index = 0
  ) => {
    const questions =
      challengeData[selectedType]?.[selectedDifficulty];

    if (!questions || questions.length === 0) {
      return;
    }

    const safeIndex =
      index >= 0 && index < questions.length
        ? index
        : 0;

    const selectedQuestion = questions[safeIndex];

    setType(selectedType);
    setDifficulty(selectedDifficulty);
    setQuestionIndex(safeIndex);

    setQuestion(selectedQuestion.question);
    setCorrectAnswer(selectedQuestion.answer);

    setAnswer("");
    setMessage("");
    setIsCorrect(false);
  };

  // =====================================================
  // LOAD HISTORY
  // =====================================================

  const loadHistory = async () => {
    if (!email) return;

    try {
      const response = await fetch(
        `${API_URL}/challenges/history/${encodeURIComponent(email)}`
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      setHistory(
        Array.isArray(data.history)
          ? data.history
          : []
      );
    } catch (error) {
      console.error("History error:", error);
    }
  };

  // =====================================================
  // LOAD ML DIFFICULTY
  // =====================================================

  const loadMLDifficulty = async () => {
    if (!email) {
      setMlLoading(false);
      return;
    }

    try {
      setMlLoading(true);

      const response = await fetch(
        `${API_URL}/adaptive-difficulty/${encodeURIComponent(email)}`
      );

      if (!response.ok) {
        throw new Error("ML request failed");
      }

      const data = await response.json();

      let level =
        data.next_difficulty || "Beginner";

      if (!difficultyLevels.includes(level)) {
        level = "Beginner";
      }

      setRecommendedDifficulty(level);

      setConfidence(
        Number(data.confidence) || 0
      );
    } catch (error) {
      console.error(
        "ML difficulty error:",
        error
      );

      setRecommendedDifficulty("Beginner");
      setConfidence(0);
    } finally {
      setMlLoading(false);
    }
  };

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    if (!email) {
      window.location.href = "/login";
      return;
    }

    loadHistory();
    loadMLDifficulty();
  }, [email]);

  // =====================================================
  // CHANGE TYPE
  // =====================================================

  const handleTypeChange = (event) => {
    const newType = event.target.value;

    setChallenge(
      newType,
      difficulty,
      0
    );
  };

  // =====================================================
  // CHANGE DIFFICULTY
  // =====================================================

  const handleDifficultyChange = (event) => {
    const newDifficulty = event.target.value;

    setChallenge(
      type,
      newDifficulty,
      0
    );
  };

  // =====================================================
  // NEXT QUESTION
  // =====================================================

  const nextQuestion = () => {
    const questions =
      challengeData[type]?.[difficulty];

    if (!questions) return;

    const nextIndex =
      (questionIndex + 1) %
      questions.length;

    setChallenge(
      type,
      difficulty,
      nextIndex
    );
  };

  // =====================================================
  // CHECK ANSWER
  // =====================================================

  const checkAnswer = async (event) => {
    event.preventDefault();

    if (!answer.trim()) {
      setMessage("Please enter your answer.");
      setIsCorrect(false);
      return;
    }

    const frontendCorrect =
      normalizeAnswer(answer) ===
      normalizeAnswer(correctAnswer);

    setLoading(true);

    try {
      let backendCorrect = frontendCorrect;

      try {
        const response = await fetch(
          `${API_URL}/challenges/evaluate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              question,
              answer: answer.trim(),
              correct_answer: correctAnswer,
              challenge_type: type,
              difficulty,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();

          backendCorrect =
            data.correct === true;
        }
      } catch (backendError) {
        console.warn(
          "Backend evaluation unavailable. Using local answer check."
        );
      }

      const finalCorrect =
        frontendCorrect && backendCorrect;

      if (finalCorrect) {
        setIsCorrect(true);

        setMessage(
          "✅ Correct! Well done."
        );

        try {
          await fetch(
            `${API_URL}/challenges/history`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                email,
                challenge_type: type,
                difficulty,
                question,
                answer: answer.trim(),
                correct: true,
                status: "Completed",
              }),
            }
          );
        } catch (historyError) {
          console.warn(
            "Could not save history:",
            historyError
          );
        }

        await loadHistory();
        await loadMLDifficulty();
      } else {
        setIsCorrect(false);

        setMessage(
          "❌ Incorrect. Try again."
        );
      }
    } catch (error) {
      console.error(
        "Challenge error:",
        error
      );

      setIsCorrect(false);

      setMessage(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    localStorage.removeItem("role");

    window.location.href = "/login";
  };

  // =====================================================
  // CURRENT QUESTIONS
  // =====================================================

  const currentQuestions =
    challengeData[type]?.[difficulty] || [];

  // =====================================================
  // AI NEXT LEVEL SUGGESTION
  // =====================================================

  const aiSuggestedDifficulty = {
    Beginner: "Easy",
    Easy: "Medium",
    Medium: "Hard",
    Hard: "Expert",
    Expert: "Expert",
  }[difficulty];

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="alarm-page">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="sidebar-logo">
          COGNIA
        </div>

        <nav>
          <a href="/dashboard">
            Dashboard
          </a>

          <a href="/alarms">
            Alarms
          </a>

          <a href="/habits">
            Habits
          </a>

          <a
            href="/challenges"
            className="active-menu"
          >
            Challenges
          </a>

          <a href="/analytics">
            Analytics
          </a>

          <a href="/profile">
            Profile
          </a>
        </nav>

        <button
          className="logout"
          onClick={logout}
        >
          Logout
        </button>

      </aside>

      {/* MAIN */}

      <main className="alarm-content">

        {/* HEADER */}

        <div className="page-header">

          <p className="welcome-small">
            🧠 COGNITIVE TRAINING
          </p>

          <h1>
            Practice Your Brain
          </h1>

          <p className="page-subtitle">
            Train your memory, logic,
            problem-solving and reasoning
            skills.
          </p>

        </div>

        {/* =================================================
            AI RECOMMENDATION
        ================================================= */}

        <div className="ai-recommendation-card">

          <h2>
            🤖 AI Difficulty Recommendation
          </h2>

          {mlLoading ? (

            <p className="ai-loading">
              AI is analyzing your previous
              performance...
            </p>

          ) : (

            <>

              <p className="ai-info">
                Recommended Level:
                <strong>
                  {recommendedDifficulty}
                </strong>
              </p>

              <p className="ai-info">
                Model:
                <strong>
                  Decision Tree Classifier
                </strong>
              </p>

              <p className="ai-info">
                Confidence:
                <strong>
                  {confidence}%
                </strong>
              </p>

              <p className="ai-description">
                This recommendation is based
                on your challenge performance.
              </p>

            </>

          )}

        </div>

        {/* =================================================
            CHALLENGE SELECTOR
        ================================================= */}

        <div className="alarm-layout">

          <div className="create-alarm-card">

            <h2>
              🎯 Choose a Challenge
            </h2>

            <p className="card-description">
              Practice any challenge type
              and difficulty.
            </p>

            {/* TYPE */}

            <label>
              Challenge Type
            </label>

            <select
              value={type}
              onChange={handleTypeChange}
            >

              {challengeTypes.map(
                (challengeType) => (
                  <option
                    key={challengeType}
                    value={challengeType}
                  >
                    {challengeType}
                  </option>
                )
              )}

            </select>

            {/* DIFFICULTY */}

            <label>
              Difficulty
            </label>

            <select
              value={difficulty}
              onChange={
                handleDifficultyChange
              }
            >

              {difficultyLevels.map(
                (level) => (
                  <option
                    key={level}
                    value={level}
                  >
                    {level}
                  </option>
                )
              )}

            </select>

            {/* QUESTION */}

            <div className="alarm-preview challenge-question-card">

              <p className="preview-label">
                {type.toUpperCase()}
              </p>

              <div className="question-counter">
                {difficulty} • Question{" "}
                {questionIndex + 1} of{" "}
                {currentQuestions.length}
              </div>

              <h2>
                {question}
              </h2>

            </div>

            {/* ANSWER */}

            <form onSubmit={checkAnswer}>

              <label>
                Your Answer
              </label>

              <input
                type="text"
                value={answer}
                placeholder="Enter your answer"
                onChange={(event) =>
                  setAnswer(
                    event.target.value
                  )
                }
                disabled={loading}
              />

              <button
                type="submit"
                className="save-alarm-button"
                disabled={
                  loading || !question
                }
              >
                {loading
                  ? "Checking..."
                  : "✓ Check Answer"}
              </button>

            </form>

            {/* NEXT */}

            <button
              type="button"
              onClick={nextQuestion}
              className="next-question-button"
            >
              Next Question →
            </button>

            {/* MESSAGE */}

            {message && (

              <div
                className={
                  isCorrect
                    ? "challenge-success"
                    : "challenge-error"
                }
              >

                {message}

                {isCorrect && (

                  <div className="correct-answer">
                    Correct answer:{" "}
                    <strong>
                      {correctAnswer}
                    </strong>
                  </div>

                )}

              </div>

            )}

          </div>

          {/* =================================================
              TRAINING SUMMARY
          ================================================= */}

          <div className="alarm-preview">

            <div className="preview-icon">
              🧠
            </div>

            <p className="preview-label">
              TRAINING MODE
            </p>

            <h2>
              {type}
            </h2>

            <p>
              Current Level
            </p>

            <h3>
              {difficulty}
            </h3>

            <div className="preview-divider" />

            <p className="preview-label">
              QUESTIONS
            </p>

            <h3>
              {currentQuestions.length}
            </h3>

            <p>
              Questions available at this
              difficulty.
            </p>

            {/* AI SUGGEST */}

            <div className="ai-suggest-box">

              <span>
                🤖 AI suggests:
              </span>

              <strong>
                {aiSuggestedDifficulty}
              </strong>

            </div>

          </div>

        </div>

        {/* =================================================
            CHALLENGE TYPES
        ================================================= */}

        <div className="section-title">

          <h2>
            Challenge Types
          </h2>

        </div>

        <div className="challenge-type-grid">

          {challengeTypes.map(
            (challengeType) => (

              <button
                key={challengeType}
                type="button"
                onClick={() =>
                  setChallenge(
                    challengeType,
                    difficulty,
                    0
                  )
                }
                className={
                  type === challengeType
                    ? "challenge-type-button selected"
                    : "challenge-type-button"
                }
              >
                {challengeType}
              </button>

            )
          )}

        </div>

        {/* =================================================
            HISTORY
        ================================================= */}

        <div className="section-title">

          <h2>
            Challenge History
          </h2>

        </div>

        {history.length === 0 ? (

          <div className="active-alarm-card">

            <div className="active-alarm-icon">
              🧩
            </div>

            <div className="active-alarm-info">

              <h3>
                No completed challenges
              </h3>

              <p>
                Complete your first challenge
                to see your history here.
              </p>

            </div>

          </div>

        ) : (

          history.map(
            (item, index) => (

              <div
                className="active-alarm-card"
                key={
                  item._id || index
                }
              >

                <div className="active-alarm-icon">
                  🧩
                </div>

                <div className="active-alarm-info">

                  <h3>
                    {item.challenge_type}
                  </h3>

                  <p>
                    {item.question}
                  </p>

                  <small>
                    Difficulty:{" "}
                    {item.difficulty}
                  </small>

                </div>

                <div className="active-status">
                  {item.correct
                    ? "Completed"
                    : "Incorrect"}
                </div>

              </div>

            )
          )

        )}

      </main>

    </div>
  );
}

export default Challenges;

