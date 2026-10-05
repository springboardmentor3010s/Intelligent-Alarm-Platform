
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [adaptive, setAdaptive] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const email = localStorage.getItem("email");
  const role = localStorage.getItem("role") || "User";

  // =========================================================
  // LOAD DASHBOARD
  // =========================================================

  useEffect(() => {
    if (!email) {
      navigate("/login");
      return;
    }

    const loadDashboard = async () => {
      try {
        setLoading(true);

        // Dashboard
        const dashboardResponse = await fetch(
          `http://localhost:8000/dashboard/${encodeURIComponent(email)}`
        );

        if (!dashboardResponse.ok) {
          throw new Error("Failed to load dashboard");
        }

        const dashboardData = await dashboardResponse.json();
        setDashboard(dashboardData);

        // Adaptive Intelligence
        try {
          const adaptiveResponse = await fetch(
            `http://localhost:8000/adaptive-difficulty/${encodeURIComponent(
              email
            )}`
          );

          if (adaptiveResponse.ok) {
            const adaptiveData = await adaptiveResponse.json();
            setAdaptive(adaptiveData);
          }
        } catch (error) {
          console.error("Adaptive difficulty error:", error);
        }

        // Analytics
        try {
          const analyticsResponse = await fetch(
            `http://localhost:8000/analytics/dashboard/${encodeURIComponent(
              email
            )}`
          );

          if (analyticsResponse.ok) {
            const analyticsData = await analyticsResponse.json();

            if (analyticsData.success) {
              setAnalytics(analyticsData);
            }
          }
        } catch (error) {
          console.error("Analytics error:", error);
        }
      } catch (error) {
        console.error("Dashboard error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [email, navigate]);

  // =========================================================
  // LOGOUT
  // =========================================================

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    localStorage.removeItem("role");

    navigate("/login");
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="dashboard">
        <main className="dashboard-content">
          <h2>Loading COGNIA...</h2>
          <p>Preparing your intelligent dashboard.</p>
        </main>
      </div>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (!dashboard) {
    return (
      <div className="dashboard">
        <main className="dashboard-content">
          <h2>Unable to load dashboard</h2>

          <p>
            Make sure the FastAPI backend is running on port 8000.
          </p>

          <button
            className="view-button"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </main>
      </div>
    );
  }

  // =========================================================
  // DATA
  // =========================================================

  const user = dashboard.user || {};
  const stats = dashboard.statistics || {};
  const analyticsSummary = analytics?.summary || {};

  const habitScore = Number(
    analyticsSummary.habit_score ??
      stats.habit_score ??
      0
  );

  const challengeAccuracy = Number(
    analyticsSummary.challenge_accuracy ??
      stats.challenge_accuracy ??
      0
  );

  const wakeUpSuccess = Number(
    analyticsSummary.wake_up_success_rate ?? 0
  );

  const overallScore = Number(
    analyticsSummary.overall_score ?? 0
  );

  const totalAlarms = Number(
    analyticsSummary.total_alarms ?? 0
  );

  const activeAlarms = Number(
    analyticsSummary.active_alarms ?? 0
  );

  const totalChallenges = Number(
    analyticsSummary.total_challenges ??
      stats.total_challenges ??
      0
  );

  const totalWakeups = Number(
    analyticsSummary.total_wakeups ??
      stats.total_wakeups ??
      0
  );

  const snoozeCount = Number(
    analyticsSummary.snooze_count ?? 0
  );

  const recommendedDifficulty =
    adaptive?.next_difficulty ||
    stats.recommended_difficulty ||
    "Easy";

  // =========================================================
  // AI RECOMMENDATION
  // =========================================================

  let aiRecommendation =
    "Keep maintaining a consistent wake-up routine.";

  if (overallScore >= 85) {
    aiRecommendation =
      "Excellent progress! Maintain your current wake-up routine and challenge performance.";
  } else if (overallScore >= 70) {
    aiRecommendation =
      "Good progress. Maintain the same wake-up time consistently to improve your habit score.";
  } else if (challengeAccuracy < 60) {
    aiRecommendation =
      "Focus on completing cognitive challenges accurately. COGNIA will gradually adapt the difficulty.";
  } else if (wakeUpSuccess < 70) {
    aiRecommendation =
      "Try reducing delayed wake-ups and follow your scheduled alarm consistently.";
  } else {
    aiRecommendation =
      "Continue completing challenges and maintaining a regular sleep and wake-up schedule.";
  }

  // =========================================================
  // DASHBOARD
  // =========================================================

  return (
    <div className="dashboard">

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside className="sidebar">

        <div className="sidebar-logo">
          🧠 COGNIA
        </div>

        <nav>

          <a
            href="/dashboard"
            onClick={(e) => {
              e.preventDefault();
              navigate("/dashboard");
            }}
          >
            🏠 Dashboard
          </a>

          <a
            href="/alarms"
            onClick={(e) => {
              e.preventDefault();
              navigate("/alarms");
            }}
          >
            ⏰ Alarms
          </a>

          <a
            href="/habits"
            onClick={(e) => {
              e.preventDefault();
              navigate("/habits");
            }}
          >
            🌱 Habits
          </a>

          <a
            href="/challenges"
            onClick={(e) => {
              e.preventDefault();
              navigate("/challenges");
            }}
          >
            🧩 Challenges
          </a>

          <a
            href="/analytics"
            onClick={(e) => {
              e.preventDefault();
              navigate("/analytics");
            }}
          >
            📊 Analytics
          </a>

          {/* WELLNESS COACH */}

          <a
            href="/coach"
            onClick={(e) => {
              e.preventDefault();
              navigate("/coach");
            }}
          >
            👩‍🏫 Wellness Coach
          </a>

          <a
            href="/profile"
            onClick={(e) => {
              e.preventDefault();
              navigate("/profile");
            }}
          >
            👤 Profile
          </a>

        </nav>

        <button
          className="logout"
          onClick={logout}
        >
          🚪 Logout
        </button>

      </aside>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <main className="dashboard-content">

        {/* HEADER */}

        <div className="dashboard-header">

          <div>

            <p className="welcome-small">
              COGNIA INTELLIGENCE
            </p>

            <h1>
              Welcome back 👋
            </h1>

            <p className="dashboard-subtitle">
              Your intelligent wake-up and productivity overview.
            </p>

          </div>

          <div className="profile-circle">
            {user.name
              ? user.name.charAt(0).toUpperCase()
              : "U"}
          </div>

        </div>

        {/* =====================================================
            EXECUTIVE SUMMARY
        ===================================================== */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "18px",
            marginBottom: "25px",
          }}
        >

          <div className="stat-card">

            <div className="stat-icon">
              📊
            </div>

            <p>Overall Score</p>

            <h2>
              {overallScore}%
            </h2>

            <span>
              COGNIA performance
            </span>

          </div>

          <div className="stat-card">

            <div className="stat-icon">
              ⏰
            </div>

            <p>Wake-up Success</p>

            <h2>
              {wakeUpSuccess}%
            </h2>

            <span>
              Successful wake-ups
            </span>

          </div>

          <div className="stat-card">

            <div className="stat-icon">
              🧠
            </div>

            <p>Challenge Accuracy</p>

            <h2>
              {challengeAccuracy}%
            </h2>

            <span>
              {totalChallenges} challenges
            </span>

          </div>

          <div className="stat-card">

            <div className="stat-icon">
              🔔
            </div>

            <p>Total Alarms</p>

            <h2>
              {totalAlarms}
            </h2>

            <span>
              {activeAlarms} active
            </span>

          </div>

        </div>

        {/* =====================================================
            NORMAL STATISTICS
        ===================================================== */}

        <div className="stats-grid">

          <div className="stat-card">

            <div className="stat-icon">
              ⏰
            </div>

            <p>Next Alarm</p>

            <h2>
              07:00 AM
            </h2>

            <span>
              Active
            </span>

          </div>

          <div className="stat-card">

            <div className="stat-icon">
              🌱
            </div>

            <p>Habit Score</p>

            <h2>
              {habitScore}%
            </h2>

            <span>
              Based on your habits
            </span>

          </div>

          <div className="stat-card">

            <div className="stat-icon">
              🧠
            </div>

            <p>Challenge Accuracy</p>

            <h2>
              {challengeAccuracy}%
            </h2>

            <span>
              {totalChallenges} completed
            </span>

          </div>

          <div className="stat-card">

            <div className="stat-icon">
              🔥
            </div>

            <p>Wake-ups</p>

            <h2>
              {totalWakeups}
            </h2>

            <span>
              Successful wake-ups
            </span>

          </div>

        </div>

        {/* =====================================================
            PERFORMANCE OVERVIEW
        ===================================================== */}

        <div className="section-title">

          <h2>
            📊 Performance Overview
          </h2>

          <button
            className="view-button"
            onClick={() => navigate("/analytics")}
          >
            Full Analytics
          </button>

        </div>

        <div className="progress-card">

          <div style={{ width: "100%" }}>

            <h3>
              Overall COGNIA Performance
            </h3>

            <p>
              Your current performance across wake-up,
              challenges and habit formation.
            </p>

            {/* Overall */}

            <div style={{ marginTop: "20px" }}>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <strong>Overall Score</strong>
                <strong>{overallScore}%</strong>
              </div>

              <div
                style={{
                  width: "100%",
                  height: "10px",
                  background: "#e5e7eb",
                  borderRadius: "10px",
                  marginTop: "8px",
                  overflow: "hidden",
                }}
              >

                <div
                  style={{
                    width: `${Math.min(
                      overallScore,
                      100
                    )}%`,
                    height: "100%",
                    background: "#2563eb",
                    borderRadius: "10px",
                  }}
                />

              </div>

            </div>

            {/* Challenge */}

            <div style={{ marginTop: "18px" }}>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <strong>Challenge Accuracy</strong>
                <strong>{challengeAccuracy}%</strong>
              </div>

              <div
                style={{
                  width: "100%",
                  height: "10px",
                  background: "#e5e7eb",
                  borderRadius: "10px",
                  marginTop: "8px",
                  overflow: "hidden",
                }}
              >

                <div
                  style={{
                    width: `${Math.min(
                      challengeAccuracy,
                      100
                    )}%`,
                    height: "100%",
                    background: "#22c55e",
                    borderRadius: "10px",
                  }}
                />

              </div>

            </div>

            {/* Wake-up */}

            <div style={{ marginTop: "18px" }}>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <strong>Wake-up Success</strong>
                <strong>{wakeUpSuccess}%</strong>
              </div>

              <div
                style={{
                  width: "100%",
                  height: "10px",
                  background: "#e5e7eb",
                  borderRadius: "10px",
                  marginTop: "8px",
                  overflow: "hidden",
                }}
              >

                <div
                  style={{
                    width: `${Math.min(
                      wakeUpSuccess,
                      100
                    )}%`,
                    height: "100%",
                    background: "#8b5cf6",
                    borderRadius: "10px",
                  }}
                />

              </div>

            </div>

            {/* Habit */}

            <div style={{ marginTop: "18px" }}>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <strong>Habit Score</strong>
                <strong>{habitScore}%</strong>
              </div>

              <div
                style={{
                  width: "100%",
                  height: "10px",
                  background: "#e5e7eb",
                  borderRadius: "10px",
                  marginTop: "8px",
                  overflow: "hidden",
                }}
              >

                <div
                  style={{
                    width: `${Math.min(
                      habitScore,
                      100
                    )}%`,
                    height: "100%",
                    background: "#f59e0b",
                    borderRadius: "10px",
                  }}
                />

              </div>

            </div>

          </div>

        </div>

        {/* =====================================================
            TODAY'S ALARM
        ===================================================== */}

        <div className="section-title">

          <h2>
            Today's Alarm
          </h2>

          <button
            className="view-button"
            onClick={() => navigate("/alarms")}
          >
            View All
          </button>

        </div>

        <div className="alarm-card">

          <div className="alarm-left">

            <div className="big-alarm">
              ⏰
            </div>

            <div>

              <h3>
                Morning Focus
              </h3>

              <p>
                07:00 AM • Daily
              </p>

            </div>

          </div>

          <div className="alarm-middle">

            <span className="challenge-badge">
              🧩 Math Challenge
            </span>

            <p>
              Difficulty: {recommendedDifficulty}
            </p>

          </div>

          <div className="alarm-status">

            <span></span>

            Active

          </div>

        </div>

        {/* =====================================================
            ADAPTIVE AI
        ===================================================== */}

        <div className="progress-card">

          <div>

            <h3>
              🤖 COGNIA Adaptive AI
            </h3>

            <p>
              Your next cognitive challenge difficulty is:
            </p>

            <h2>
              {recommendedDifficulty}
            </h2>

            {adaptive && (
              <>

                <p>
                  ML Model:{" "}
                  {adaptive.model || "Decision Tree Classifier"}
                </p>

                <p>
                  Confidence:{" "}
                  {adaptive.confidence ?? 100}%
                </p>

                <p>
                  Accuracy:{" "}
                  {adaptive.accuracy ?? 100}%
                </p>

                <p>
                  Attempts analyzed:{" "}
                  {adaptive.attempts_analyzed ?? 0}
                </p>

              </>
            )}

          </div>

        </div>

        {/* =====================================================
            BEHAVIORAL ANALYTICS
        ===================================================== */}

        <div className="section-title">

          <h2>
            🧠 Behavioral Analytics
          </h2>

          <button
            className="view-button"
            onClick={() => navigate("/analytics")}
          >
            View Analytics
          </button>

        </div>

        <div className="progress-card">

          <div>

            <h3>
              Wake-up Consistency
            </h3>

            <p>
              Your wake-up behavior is being tracked by COGNIA.
            </p>

            <p>
              Total wake-ups: {totalWakeups}
            </p>

            <p>
              Challenge accuracy: {challengeAccuracy}%
            </p>

            <p>
              Wake-up success: {wakeUpSuccess}%
            </p>

            <p>
              Snoozes recorded: {snoozeCount}
            </p>

          </div>

          <div className="large-score">
            {habitScore}%
          </div>

        </div>

        {/* =====================================================
            SLEEP ANALYTICS
        ===================================================== */}

        <div className="progress-card">

          <div>

            <h3>
              😴 Sleep Analytics
            </h3>

            <p>
              Average sleep:{" "}
              {stats.average_sleep_hours ?? "N/A"} hours
            </p>

            <p>
              Target sleep:{" "}
              {stats.target_sleep_hours ?? "N/A"} hours
            </p>

            <p>
              Sleep adherence:{" "}
              {stats.sleep_adherence ?? 0}%
            </p>

            <p>
              {stats.sleep_status ||
                "Record your sleep to see sleep analytics."}
            </p>

          </div>

        </div>

        {/* =====================================================
            AI INSIGHT
        ===================================================== */}

        <div className="progress-card">

          <div>

            <h3>
              🤖 COGNIA AI Insight
            </h3>

            <p>
              {aiRecommendation}
            </p>

            <p>
              Next recommended difficulty:{" "}
              <strong>
                {recommendedDifficulty}
              </strong>
            </p>

            <p>
              COGNIA has analyzed{" "}
              <strong>
                {totalChallenges}
              </strong>{" "}
              cognitive challenge attempts.
            </p>

          </div>

        </div>

        {/* =====================================================
            WELLNESS COACH
        ===================================================== */}

        <div
          style={{
            marginTop: "30px",
            padding: "25px",
            borderRadius: "16px",
            background:
              "linear-gradient(135deg, #eef4ff, #ffffff)",
            border: "1px solid #dbe5ff",
            boxShadow:
              "0 6px 20px rgba(0, 0, 0, 0.08)",
          }}
        >

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >

            <div>

              <p
                style={{
                  margin: "0 0 6px",
                  color: "#2563eb",
                  fontWeight: "600",
                  fontSize: "13px",
                  textTransform: "uppercase",
                }}
              >
                Wellness & Monitoring
              </p>

              <h2
                style={{
                  margin: "0 0 8px",
                  color: "#1e3a8a",
                }}
              >
                👩‍🏫 Wellness Coach
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "#475569",
                  fontSize: "15px",
                }}
              >
                Monitor wake-up habits, cognitive performance,
                sleep patterns and wellness progress.
              </p>

            </div>

            <button
              onClick={() => navigate("/coach")}
              style={{
                padding: "12px 20px",
                border: "none",
                borderRadius: "10px",
                background: "#2563eb",
                color: "#ffffff",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Open Wellness Coach →
            </button>

          </div>

        </div>

        {/* =====================================================
            MILESTONE 4 STATUS
        ===================================================== */}

        <div className="progress-card">

          <div>

            <h3>
              🚀 Milestone 4 Progress
            </h3>

            <p>
              Executive analytics dashboard: ✅ Operational
            </p>

            <p>
              Behavioral analytics: ✅ Operational
            </p>

            <p>
              Adaptive intelligence: ✅ Operational
            </p>

            <p>
              Wake-up analytics: ✅ Operational
            </p>

            <p>
              Reporting system: ✅ Operational
            </p>

            <p>
              Docker containerization: ✅ Operational
            </p>

            <p>
              Cloud deployment:  ✅ Operational
            </p>

          </div>

        </div>

      </main>

    </div>
  );
}

export default Dashboard;

