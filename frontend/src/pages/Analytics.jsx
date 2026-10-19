
import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Bar, Line, Doughnut } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend
);

const API_URL = "http://localhost:8001";

function Analytics() {
  const email =
    localStorage.getItem("email") ||
    "kavin_new2026@gmail.com";

  const [analytics, setAnalytics] = useState({});
  const [habitScore, setHabitScore] = useState({});
  const [adaptive, setAdaptive] = useState({});
  const [recommendations, setRecommendations] = useState({});
  const [dashboard, setDashboard] = useState({});
  const [wakeHistory, setWakeHistory] = useState([]);
  const [challengeHistory, setChallengeHistory] = useState([]);
  const [sleepHistory, setSleepHistory] = useState([]);
  const [sleepAnalytics, setSleepAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  // =====================================================
  // LOAD ANALYTICS
  // =====================================================

  async function loadAnalytics() {
    setLoading(true);
    setError("");

    const encodedEmail = encodeURIComponent(email);

    const endpoints = {
      dashboard: `/analytics/dashboard/${encodedEmail}`,
      analytics: `/analytics/${encodedEmail}`,
      habit: `/habit-score/${encodedEmail}`,
      adaptive: `/adaptive-difficulty/${encodedEmail}`,
      recommendations: `/recommendations/${encodedEmail}`,
      wake: `/wake-up/history/${encodedEmail}`,
      challenge: `/challenges/history/${encodedEmail}`,
      sleepHistory: `/sleep/history/${encodedEmail}`,
      sleepAnalytics: `/sleep/analytics/${encodedEmail}`,
    };

    try {
      const entries = await Promise.all(
        Object.entries(endpoints).map(async ([key, path]) => {
          try {
            const response = await fetch(`${API_URL}${path}`);
            if (!response.ok) return [key, null];
            return [key, await response.json()];
          } catch {
            return [key, null];
          }
        })
      );

      const data = Object.fromEntries(entries);

      setDashboard(data.dashboard || {});
      setAnalytics(data.analytics || {});
      setHabitScore(data.habit || {});
      setAdaptive(data.adaptive || {});
      setRecommendations(data.recommendations || {});
      setWakeHistory(data.wake?.history || []);
      setChallengeHistory(data.challenge?.history || []);
      setSleepHistory(data.sleepHistory?.history || []);
      setSleepAnalytics(data.sleepAnalytics || {});
    } catch (err) {
      console.error(err);
      setError("Could not load analytics. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // VALUES
  // =====================================================

  const summary = dashboard?.summary || {};
  const components = dashboard?.habit_components || {};

  const overallScore = Number(summary.overall_score ?? 0);
  const habit = Number(
    summary.habit_score ?? habitScore?.habit_score ?? 0
  );
  const challengeAccuracy = Number(
    summary.challenge_accuracy ?? analytics?.accuracy ?? 0
  );
  const wakeSuccess = Number(summary.wake_up_success_rate ?? 0);
  const totalWakeups = Number(
    summary.total_wakeups ?? wakeHistory.length
  );
  const snoozeCount = Number(summary.snooze_count ?? 0);
  const totalAlarms = Number(summary.total_alarms ?? 0);
  const activeAlarms = Number(summary.active_alarms ?? 0);

  const totalChallenges = Number(
    summary.total_challenges ??
      analytics?.total_challenges ??
      challengeHistory.length
  );

  const correctChallenges = Number(
    summary.correct_challenges ??
      analytics?.correct ??
      challengeHistory.filter((item) => item.correct === true).length
  );

  const incorrectChallenges = Number(
    summary.incorrect_challenges ??
      analytics?.incorrect ??
      Math.max(totalChallenges - correctChallenges, 0)
  );

  const wakeConsistency = Number(
    components.wake_up_consistency ?? 0
  );
  const challengeCompletion = Number(
    components.challenge_completion ?? challengeAccuracy
  );
  const snoozeReduction = Number(
    components.snooze_reduction ?? 0
  );
  const sleepAdherence = Number(
    components.sleep_schedule_adherence ??
      sleepAnalytics?.sleep_adherence ??
      0
  );

  const totalSleepRecords = Number(
    sleepAnalytics?.records_analyzed ?? sleepHistory.length
  );
  const averageSleepHours = Number(
    sleepAnalytics?.average_sleep_hours ?? 0
  );
  const targetSleepHours = Number(
    sleepAnalytics?.target_sleep_hours ?? 8
  );
  const averageSleepAdherence = Number(
    sleepAnalytics?.sleep_adherence ?? 0
  );
  const sleepQuality =
    sleepAnalytics?.average_sleep_quality ??
    sleepAnalytics?.sleep_quality ??
    "N/A";

  const recommendedDifficulty =
    adaptive?.next_difficulty ??
    dashboard?.recommended_difficulty ??
    "Easy";

  const mlConfidence =
    adaptive?.confidence ?? dashboard?.ml_confidence ?? 0;

  const recentWakeHistory = wakeHistory.slice(-10);
  const recentChallengeHistory = challengeHistory.slice(-10);

  // =====================================================
  // CHART DATA
  // =====================================================

  const performanceChart = {
    labels: ["Overall", "Challenges", "Wake-up", "Habit"],
    datasets: [
      {
        label: "COGNIA Performance %",
        data: [
          overallScore,
          challengeAccuracy,
          wakeSuccess,
          habit,
        ],
        backgroundColor: ["#2563eb", "#7c3aed", "#0891b2", "#16a34a"],
        borderRadius: 8,
      },
    ],
  };

  const challengeChart = {
    labels: ["Correct", "Incorrect"],
    datasets: [
      {
        data: [correctChallenges, incorrectChallenges],
        backgroundColor: ["#16a34a", "#ef4444"],
      },
    ],
  };

  const habitChart = {
    labels: [
      "Wake-up Consistency",
      "Challenge Completion",
      "Snooze Reduction",
      "Sleep Adherence",
    ],
    datasets: [
      {
        label: "Habit Components %",
        data: [
          wakeConsistency,
          challengeCompletion,
          snoozeReduction,
          sleepAdherence,
        ],
        backgroundColor: ["#2563eb", "#7c3aed", "#0891b2", "#16a34a"],
        borderRadius: 7,
      },
    ],
  };

  const wakeTrendChart = {
    labels: recentWakeHistory.map((_, i) => `Wake-up ${i + 1}`),
    datasets: [
      {
        label: "Successful Wake-up %",
        data: recentWakeHistory.map((item) =>
          item.verified ? 100 : 0
        ),
        borderColor: "#2563eb",
        backgroundColor: "#dbeafe",
        tension: 0.3,
      },
    ],
  };

  const challengeTrendChart = {
    labels: recentChallengeHistory.map((_, i) => `Attempt ${i + 1}`),
    datasets: [
      {
        label: "Challenge Result %",
        data: recentChallengeHistory.map((item) =>
          item.correct ? 100 : 0
        ),
        borderColor: "#7c3aed",
        backgroundColor: "#ede9fe",
        tension: 0.3,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true, max: 100 },
    },
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
  };

  // =====================================================
  // PDF REPORT
  // =====================================================

  function downloadReport() {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 18;
      const maxWidth = pageWidth - margin * 2;
      let y = 20;

      function ensureSpace(height = 10) {
        if (y + height > pageHeight - 18) {
          doc.addPage();
          y = 20;
        }
      }

      function heading(text) {
        ensureSpace(16);
        y += 3;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(37, 99, 235);
        doc.text(text, margin, y);
        y += 9;
      }

      function detail(label, value) {
        const text = `${label}: ${value ?? "N/A"}`;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        const lines = doc.splitTextToSize(text, maxWidth);
        ensureSpace(lines.length * 6 + 3);
        doc.setTextColor(45, 55, 72);
        doc.text(lines, margin, y);
        y += lines.length * 6 + 3;
      }

      // Report header
      doc.setFillColor(239, 246, 255);
      doc.rect(0, 0, pageWidth, 48, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(30, 64, 175);
      doc.text("COGNIA INTELLIGENCE", margin, 20);
      doc.setFontSize(16);
      doc.text("Smart Analytics Report", margin, 31);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`User: ${email}`, margin, 39);
      doc.text(
        `Generated: ${new Date().toLocaleString()}`,
        margin,
        44
      );
      y = 58;

      // Executive summary
      heading("1. Executive Summary");
      [
        ["Overall COGNIA Score", `${overallScore}%`],
        ["Wake-up Success", `${wakeSuccess}%`],
        ["Challenge Accuracy", `${challengeAccuracy}%`],
        ["Total Alarms", totalAlarms],
        ["Active Alarms", activeAlarms],
        ["Total Challenges", totalChallenges],
        ["Correct Challenges", correctChallenges],
        ["Incorrect Challenges", incorrectChallenges],
        ["Habit Score", `${habit.toFixed(2)}%`],
        ["Snooze Count", snoozeCount],
      ].forEach(([label, value]) => detail(label, value));

      // Habit analytics
      heading("2. Behavioral Habit Intelligence");
      [
        ["Overall Habit Score", `${habit.toFixed(2)}%`],
        ["Wake-up Consistency", `${wakeConsistency}%`],
        ["Challenge Completion", `${challengeCompletion}%`],
        ["Snooze Reduction", `${snoozeReduction}%`],
        ["Sleep Schedule Adherence", `${sleepAdherence}%`],
      ].forEach(([label, value]) => detail(label, value));

      // Sleep analytics
      heading("3. Sleep Analytics");
      [
        ["Sleep Records", totalSleepRecords],
        ["Average Sleep", `${averageSleepHours} hours`],
        ["Target Sleep", `${targetSleepHours} hours`],
        ["Sleep Adherence", `${averageSleepAdherence}%`],
        ["Sleep Quality", sleepQuality],
      ].forEach(([label, value]) => detail(label, value));

      heading("Sleep History");
      if (sleepHistory.length === 0) {
        detail("History", "No sleep records available");
      } else {
        sleepHistory.forEach((item, index) => {
          detail(`Session ${index + 1}`, "");
          detail("Sleep Time", item.sleep_time);
          detail("Wake Time", item.wake_time);
          detail("Duration", item.duration_hours != null
            ? `${item.duration_hours} hours`
            : "N/A");
          detail("Recorded At", item.recorded_at);
        });
      }

      // Wake-up analytics
      heading("4. Wake-up Analytics");
      [
        ["Total Wake-ups", totalWakeups],
        ["Wake-up Success Rate", `${wakeSuccess}%`],
        ["Snooze Count", snoozeCount],
        ["Wake-up Consistency", `${wakeConsistency}%`],
      ].forEach(([label, value]) => detail(label, value));

      heading("Wake-up History");
      if (wakeHistory.length === 0) {
        detail("History", "No wake-up records available");
      } else {
        wakeHistory.forEach((item, index) => {
          detail(`Wake-up ${index + 1}`, "");
          detail("Verified", item.verified ? "Yes" : "No");
          detail("Snoozed", item.snoozed ? "Yes" : "No");
          detail("Snooze Count", item.snooze_count ?? 0);
          detail("Wake-up Time", item.wake_up_time);
          detail("Scheduled Time", item.scheduled_time);
          detail("Created At", item.created_at);
        });
      }

      // Challenge analytics
      heading("5. Cognitive Challenge Analytics");
      [
        ["Total Challenges", totalChallenges],
        ["Correct Answers", correctChallenges],
        ["Incorrect Answers", incorrectChallenges],
        ["Accuracy", `${challengeAccuracy}%`],
      ].forEach(([label, value]) => detail(label, value));

      heading("Challenge History");
      if (challengeHistory.length === 0) {
        detail("History", "No challenge records available");
      } else {
        challengeHistory.forEach((item, index) => {
          detail(
            `Challenge ${index + 1}`,
            item.challenge_type || item.type || "Challenge"
          );
          detail("Question", item.question || "Not recorded");
          detail("Difficulty", item.difficulty);
          detail("Result", item.correct ? "Correct" : "Incorrect");
          detail("Completion Time",
            `${item.completion_time_seconds ?? 0} seconds`);
          detail("Completed At", item.completed_at);
        });
      }

      // Adaptive intelligence
      heading("6. Adaptive Intelligence");
      [
        ["Recommended Difficulty", recommendedDifficulty],
        ["ML Model", adaptive?.model || "Decision Tree Classifier"],
        ["Confidence", `${mlConfidence}%`],
        ["Model Accuracy", `${adaptive?.accuracy ?? 0}%`],
        ["Attempts Analyzed", adaptive?.attempts_analyzed ?? totalChallenges],
        ["Completion Rate", `${challengeCompletion}%`],
        ["Snooze Count", snoozeCount],
      ].forEach(([label, value]) => detail(label, value));

      // Recommendations
      heading("7. COGNIA AI Recommendations");
      const recommendationList = recommendations?.recommendations || [];

      if (recommendationList.length === 0) {
        detail("Recommendations", "None available yet");
      } else {
        recommendationList.forEach((item, index) =>
          detail(`Recommendation ${index + 1}`, item)
        );
      }

      // Milestone 4
      heading("8. Milestone 4 - Analytics & Intelligence");
      [
        ["Executive Analytics", "Operational"],
        ["Behavioral Analytics", "Operational"],
        ["Adaptive Intelligence", "Operational"],
        ["Wake-up Analytics", "Operational"],
        ["Sleep Analytics", "Operational"],
        ["Visualization", "Operational"],
        ["Reporting", "Operational"],
        ["Docker Containerization", "Operational"],
        ["Cloud Deployment", "Optional"],
      ].forEach(([label, value]) => detail(label, value));

      // Footer and page numbers
      const totalPages = doc.internal.getNumberOfPages();
      for (let page = 1; page <= totalPages; page++) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `COGNIA Analytics Report | Page ${page} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
      }

      doc.save("COGNIA_Analytics_Report.pdf");
    } catch (err) {
      console.error("PDF report error:", err);
      alert("Could not generate the PDF report. Please try again.");
    }
  }

  // =====================================================
  // LOADING / ERROR
  // =====================================================

  if (loading) {
    return (
      <main style={styles.page}>
        <p style={styles.eyebrow}>COGNIA INTELLIGENCE</p>
        <h1>Smart Analytics</h1>
        <p style={styles.muted}>Loading your analytics...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={styles.page}>
        <h2>Analytics Error</h2>
        <p style={styles.muted}>{error}</p>
        <button style={styles.primaryButton} onClick={loadAnalytics}>
          Try Again
        </button>
      </main>
    );
  }

  // =====================================================
  // DASHBOARD
  // =====================================================

  return (
    <main style={styles.page}>
      <header style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>COGNIA INTELLIGENCE</p>
          <h1 style={styles.title}>Smart Analytics</h1>
          <p style={styles.muted}>
            Your complete wake-up, cognitive, sleep and habit
            intelligence dashboard.
          </p>
          <p style={styles.muted}>User: {email}</p>
        </div>

        <div style={styles.actions}>
          <button style={styles.primaryButton} onClick={loadAnalytics}>
            🔄 Refresh
          </button>
          <button style={styles.darkButton} onClick={downloadReport}>
            📄 Download Report
          </button>
        </div>
      </header>

      {/* Executive summary */}
      <section style={styles.section}>
        <div style={styles.grid}>
          <Kpi icon="📊" title="Overall Score"
            value={`${overallScore}%`} subtitle="COGNIA performance" />
          <Kpi icon="⏰" title="Wake-up Success"
            value={`${wakeSuccess}%`} subtitle="Successful wake-ups" />
          <Kpi icon="🧠" title="Challenge Accuracy"
            value={`${challengeAccuracy}%`}
            subtitle={`${totalChallenges} challenges`} />
          <Kpi icon="🔔" title="Total Alarms"
            value={totalAlarms} subtitle={`${activeAlarms} active`} />
          <Kpi icon="🌱" title="Habit Score"
            value={`${habit.toFixed(2)}%`} subtitle="Routine consistency" />
          <Kpi icon="🔕" title="Snoozes"
            value={snoozeCount} subtitle="Recorded snoozes" />
        </div>
      </section>

      {/* Performance */}
      <section style={styles.section}>
        <h2>📊 Performance Overview</h2>
        <Panel title="Overall COGNIA Performance">
          <p style={styles.muted}>
            Comparison of your main intelligence and habit metrics.
          </p>
          <div style={styles.chart}>
            <Bar data={performanceChart} options={barOptions} />
          </div>
        </Panel>
      </section>

      {/* Cognitive analytics */}
      <section style={styles.section}>
        <h2>🧠 Cognitive Challenge Analytics</h2>
        <div style={styles.twoColumns}>
          <Panel title="Challenge Results">
            <div style={styles.doughnut}>
              <Doughnut data={challengeChart} options={chartOptions} />
            </div>
            <div style={styles.grid}>
              <Kpi title="Correct" value={correctChallenges} />
              <Kpi title="Incorrect" value={incorrectChallenges} />
              <Kpi title="Accuracy" value={`${challengeAccuracy}%`} />
            </div>
          </Panel>

          <Panel title="📈 Challenge Trend">
            {recentChallengeHistory.length ? (
              <div style={styles.chart}>
                <Line data={challengeTrendChart} options={barOptions} />
              </div>
            ) : <p style={styles.muted}>Complete challenges to generate a trend.</p>}
          </Panel>
        </div>
      </section>

      {/* Habits */}
      <section style={styles.section}>
        <h2>🌱 Behavioral Habit Intelligence</h2>
        <div style={styles.twoColumns}>
          <Panel title="Overall Habit Score">
            <h1 style={styles.score}>{habit.toFixed(2)}%</h1>
            <p style={styles.muted}>Weighted habit formation score.</p>
            <div style={styles.progress}>
              <div style={{
                ...styles.progressValue,
                width: `${Math.min(100, Math.max(0, habit))}%`,
              }} />
            </div>
          </Panel>
          <Panel title="Habit Components">
            <div style={styles.chart}>
              <Bar data={habitChart} options={barOptions} />
            </div>
          </Panel>
        </div>
      </section>

      {/* Wake-up analytics */}
      <section style={styles.section}>
        <h2>⏰ Wake-up Analytics</h2>
        <div style={styles.twoColumns}>
          <Panel title="Wake-up Success">
            {recentWakeHistory.length ? (
              <div style={styles.chart}>
                <Line data={wakeTrendChart} options={barOptions} />
              </div>
            ) : <p style={styles.muted}>
              Complete a wake-up verification to generate analytics.
            </p>}
          </Panel>
          <Panel title="Wake-up Statistics">
            <Stat label="Total Wake-ups" value={totalWakeups} />
            <Stat label="Successful Wake-ups" value={`${wakeSuccess}%`} />
            <Stat label="Snooze Count" value={snoozeCount} />
            <Stat label="Wake-up Consistency" value={`${wakeConsistency}%`} />
          </Panel>
        </div>
      </section>

      {/* Sleep analytics */}
      <section style={styles.section}>
        <h2>😴 Sleep Analytics</h2>
        <div style={styles.grid}>
          <Kpi icon="🛏️" title="Sleep Records"
            value={totalSleepRecords} subtitle="Recorded sessions" />
          <Kpi icon="⏱️" title="Average Sleep"
            value={`${averageSleepHours} hrs`}
            subtitle={`Target: ${targetSleepHours} hrs`} />
          <Kpi icon="📈" title="Sleep Adherence"
            value={`${averageSleepAdherence}%`} subtitle="Schedule consistency" />
          <Kpi icon="⭐" title="Sleep Quality"
            value={sleepQuality} subtitle="Recorded quality" />
        </div>

        <Panel title="🌙 Latest Sleep Session">
          {sleepHistory.length === 0 ? (
            <p style={styles.muted}>No sleep record available yet.</p>
          ) : (
            <div style={styles.grid}>
              <Detail label="Sleep Time"
                value={sleepHistory.at(-1)?.sleep_time} />
              <Detail label="Wake Time"
                value={sleepHistory.at(-1)?.wake_time} />
              <Detail label="Duration"
                value={sleepHistory.at(-1)?.duration_hours != null
                  ? `${sleepHistory.at(-1).duration_hours} hrs` : "N/A"} />
            </div>
          )}
        </Panel>
      </section>

      {/* Sleep history */}
      <section style={styles.section}>
        <h2>💤 Sleep History</h2>
        {sleepHistory.length === 0 ? (
          <Panel><p style={styles.muted}>No sleep history available.</p></Panel>
        ) : sleepHistory.map((item, index) => (
          <Panel key={index} title={`🌙 Sleep Session #${index + 1}`}>
            <div style={styles.grid}>
              <Detail label="Sleep Time" value={item.sleep_time} />
              <Detail label="Wake Time" value={item.wake_time} />
              <Detail label="Duration"
                value={item.duration_hours != null
                  ? `${item.duration_hours} hrs` : "N/A"} />
              <Detail label="Recorded" value={item.recorded_at} />
            </div>
          </Panel>
        ))}
      </section>

      {/* Wake-up history */}
      <section style={styles.section}>
        <h2>⏰ Wake-up History</h2>
        {wakeHistory.length === 0 ? (
          <Panel><p style={styles.muted}>No wake-up history available.</p></Panel>
        ) : wakeHistory.map((item, index) => (
          <Panel key={index} title={`Wake-up #${index + 1}`}>
            <div style={styles.grid}>
              <Detail label="Verified" value={item.verified ? "Yes" : "No"} />
              <Detail label="Snoozed" value={item.snoozed ? "Yes" : "No"} />
              <Detail label="Snooze Count" value={item.snooze_count ?? 0} />
              <Detail label="Wake-up Time" value={item.wake_up_time} />
              <Detail label="Scheduled Time" value={item.scheduled_time} />
              <Detail label="Created" value={item.created_at} />
            </div>
          </Panel>
        ))}
      </section>

      {/* Challenge history */}
      <section style={styles.section}>
        <h2>📚 Recent Challenge History</h2>
        {challengeHistory.length === 0 ? (
          <Panel><p style={styles.muted}>No challenge history available.</p></Panel>
        ) : challengeHistory.map((item, index) => (
          <Panel key={index} title={`🧩 ${item.challenge_type || item.type || "Challenge"}`}>
            <p>{item.question || "No question recorded"}</p>
            <div style={styles.grid}>
              <Detail label="Difficulty" value={item.difficulty} />
              <Detail label="Result" value={item.correct ? "✓ Correct" : "✕ Incorrect"} />
              <Detail label="Completion Time"
                value={`${item.completion_time_seconds ?? 0} seconds`} />
              <Detail label="Completed At" value={item.completed_at} />
            </div>
          </Panel>
        ))}
      </section>

      {/* Adaptive intelligence */}
      <section style={styles.section}>
        <h2>🤖 Adaptive Intelligence</h2>
        <Panel title="Next Cognitive Difficulty">
          <h1 style={styles.score}>{recommendedDifficulty}</h1>
          <p style={styles.muted}>
            ML model recommends {recommendedDifficulty} difficulty for your next challenge.
          </p>
          <div style={styles.grid}>
            <Detail label="ML Model"
              value={adaptive?.model || "Decision Tree Classifier"} />
            <Detail label="Confidence" value={`${mlConfidence}%`} />
            <Detail label="Model Accuracy" value={`${adaptive?.accuracy ?? 0}%`} />
            <Detail label="Attempts Analyzed"
              value={adaptive?.attempts_analyzed ?? totalChallenges} />
            <Detail label="Completion Rate" value={`${challengeCompletion}%`} />
            <Detail label="Snooze Count" value={snoozeCount} />
          </div>
        </Panel>
      </section>

      {/* Recommendations */}
      <section style={styles.section}>
        <h2>🤖 COGNIA AI Recommendations</h2>
        <Panel>
          {(recommendations?.recommendations || []).length ? (
            recommendations.recommendations.map((item, index) => (
              <p key={index} style={styles.recommendation}>💡 {item}</p>
            ))
          ) : (
            <p style={styles.muted}>No recommendations available yet.</p>
          )}
        </Panel>
      </section>

      {/* Milestone 4 */}
      <section style={styles.section}>
        <Panel title="🚀 Milestone 4 — Analytics & Intelligence">
          <div style={styles.grid}>
            {[
              "Executive Analytics",
              "Behavioral Analytics",
              "Adaptive Intelligence",
              "Wake-up Analytics",
              "Sleep Analytics",
              "Visualization",
              "Reporting",
              "Docker Containerization",
            ].map((item) => (
              <div key={item} style={styles.status}>
                <strong>✅ {item}</strong>
                <p style={styles.success}>Operational</p>
              </div>
            ))}
            <div style={styles.status}>
              <strong>☁️ Cloud Deployment</strong>
              <p style={styles.muted}>Optional</p>
            </div>
          </div>
        </Panel>
      </section>
    </main>
  );
}

// =====================================================
// REUSABLE COMPONENTS
// =====================================================

function Panel({ title, children }) {
  return (
    <div style={styles.panel}>
      {title && <h3 style={styles.panelTitle}>{title}</h3>}
      {children}
    </div>
  );
}

function Kpi({ icon, title, value, subtitle }) {
  return (
    <div style={styles.panel}>
      {icon && <div style={styles.icon}>{icon}</div>}
      <p style={styles.label}>{title}</p>
      <h2 style={styles.kpiValue}>{value}</h2>
      {subtitle && <p style={styles.muted}>{subtitle}</p>}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p style={styles.label}>{label}</p>
      <strong style={styles.detailValue}>{value ?? "N/A"}</strong>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f8fbff 0%, #f3f6fb 100%)",
    padding: "32px",
    fontFamily: "Inter, Arial, sans-serif",
    color: "#111827",
    boxSizing: "border-box",
  },
  hero: {
    maxWidth: "1150px",
    margin: "0 auto 35px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    flexWrap: "wrap",
  },
  eyebrow: {
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "2px",
  },
  title: {
    fontSize: "38px",
    margin: "5px 0 10px",
    color: "#0f172a",
  },
  muted: {
    color: "#64748b",
    lineHeight: 1.6,
  },
  section: {
    maxWidth: "1150px",
    margin: "0 auto 38px",
  },
  actions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  primaryButton: {
    padding: "12px 18px",
    border: 0,
    borderRadius: "10px",
    cursor: "pointer",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
  },
  darkButton: {
    padding: "12px 18px",
    border: 0,
    borderRadius: "10px",
    cursor: "pointer",
    background: "#0f172a",
    color: "#fff",
    fontWeight: 700,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "18px",
    marginBottom: "18px",
  },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
  },
  panel: {
    background: "#fff",
    padding: "24px",
    borderRadius: "18px",
    boxShadow: "0 8px 30px rgba(15,23,42,0.07)",
    border: "1px solid #e5e7eb",
    marginBottom: "18px",
    minWidth: 0,
  },
  panelTitle: {
    color: "#0f172a",
    marginTop: 0,
    marginBottom: "16px",
  },
  icon: {
    fontSize: "28px",
    marginBottom: "10px",
  },
  label: {
    color: "#64748b",
    fontWeight: 800,
    fontSize: "11px",
    letterSpacing: "0.7px",
    marginBottom: "7px",
  },
  kpiValue: {
    fontSize: "32px",
    margin: "5px 0",
    color: "#0f172a",
    overflowWrap: "anywhere",
  },
  detailValue: {
    color: "#111827",
    fontSize: "14px",
    overflowWrap: "anywhere",
  },
  chart: {
    height: "300px",
    marginTop: "20px",
    position: "relative",
  },
  doughnut: {
    height: "240px",
    maxWidth: "300px",
    margin: "10px auto 24px",
  },
  score: {
    fontSize: "44px",
    margin: "10px 0",
    color: "#2563eb",
  },
  progress: {
    height: "12px",
    background: "#e5e7eb",
    borderRadius: "20px",
    overflow: "hidden",
    marginTop: "20px",
  },
  progressValue: {
    height: "100%",
    background: "linear-gradient(90deg, #2563eb, #6366f1)",
    borderRadius: "20px",
    transition: "width 0.5s ease",
  },
  stat: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    padding: "15px 0",
    borderBottom: "1px solid #e5e7eb",
    color: "#475569",
  },
  recommendation: {
    padding: "12px 0",
    borderBottom: "1px solid #e5e7eb",
    lineHeight: 1.6,
  },
  status: {
    padding: "15px",
    background: "#f8fafc",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
  },
  success: {
    color: "#15803d",
    fontSize: "13px",
    marginBottom: 0,
  },
};

export default Analytics;
