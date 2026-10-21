import { useEffect, useState } from "react";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import {
  getDashboardStats,
  getPerformanceStats,
  getChallenges,
  downloadUserPerformancePdf,
  downloadUserPerformanceReport,
} from "../services/api";

import {
  PageShell,
  Card,
  StatCard,
  MetricRow,
  EmptyState,
} from "../components/ChartKit";
import {
  COLORS,
  pieColors,
  tooltipStyle,
  gridStroke,
  axisTick,
  statGrid,
  twoColGrid,
} from "../components/chartTokens";

function Results({ onBack }) {
  const [stats, setStats] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadResults();
  }, []);

  async function loadResults() {
    try {
      setLoading(true);
      setError("");

      const [dashboardData, performanceData, challengeData] = await Promise.all([
        getDashboardStats(),
        getPerformanceStats(),
        getChallenges(),
      ]);

      setStats(dashboardData);
      setPerformance(performanceData);

      const challengeList = Array.isArray(challengeData)
        ? challengeData
        : challengeData?.challenges || [];

      setChallenges(challengeList);
    } catch (err) {
      setError(typeof err === "string" ? err : "Unable to load performance results.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadReport(format) {
    try {
      setDownloading(true);
      if (format === "pdf") {
        await downloadUserPerformancePdf();
      } else {
        await downloadUserPerformanceReport();
      }
    } catch {
      alert(`Unable to generate ${format.toUpperCase()} report right now. Please try again.`);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <PageShell
        eyebrow="Intelligence Reports"
        title="Cognitive Analytics"
        subtitle="Loading your historical performance and habit data..."
        onBack={onBack}
        backLabel="← Dashboard"
      >
        <Card>
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🧠</div>
            <h3 style={{ color: "#fff", margin: "0 0 6px" }}>Analyzing your cognitive data...</h3>
            <p style={{ margin: 0, fontSize: 13 }}>Compiling wake times, challenge scores, and consistency patterns.</p>
          </div>
        </Card>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell
        eyebrow="Intelligence Reports"
        title="Cognitive Analytics"
        onBack={onBack}
        backLabel="← Dashboard"
      >
        <Card>
          <div style={{ textAlign: "center", padding: "50px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ color: "#fff", margin: "0 0 6px" }}>Unable to load analytics</h3>
            <p style={{ color: "#94a3b8", margin: "0 0 20px", fontSize: 13 }}>{error}</p>
            <button className="btn btn-primary btn-sm" onClick={loadResults}>
              Try Again
            </button>
          </div>
        </Card>
      </PageShell>
    );
  }

  /* Safe Metrics */
  const toMetricValue = (value, fallback = null) => {
    if (value === null || value === undefined || value === "") return fallback;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
  };

  const habitScore = toMetricValue(stats?.habit_score ?? stats?.habitScore ?? performance?.habit_score, null);
  const completionRate = toMetricValue(
    stats?.completion_rate ?? stats?.completionRate ?? performance?.completion_rate,
    null
  );
  const accuracy = toMetricValue(stats?.accuracy ?? performance?.accuracy, null);
  const snoozeReduction = toMetricValue(stats?.snooze_reduction, null);

  const answeredChallenges = challenges.filter(
    (item) => item.is_correct !== null && item.is_correct !== undefined
  );
  const correctAnswers = challenges.filter(
    (item) => item.is_correct === true || item.isCorrect === true
  ).length;
  const calculatedAccuracy =
    answeredChallenges.length > 0
      ? Math.round((correctAnswers / answeredChallenges.length) * 100)
      : (accuracy ?? 0);

  const typeChartData = (performance?.challenge_type_distribution || []).map(
    ({ name, value }) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    })
  );

  const challengeSessionCount = stats?.total_challenges ?? new Set(
    challenges.map((c) => c.session_id).filter(Boolean)
  ).size;

  const performanceChartData = [
    { name: "Accuracy", score: calculatedAccuracy },
    { name: "Completion", score: completionRate ?? 0 },
    { name: "Snooze reduction", score: snoozeReduction ?? 0 },
    { name: "Habit score", score: habitScore ?? 0 },
  ];

  const readinessData = [
    { metric: "Accuracy", score: calculatedAccuracy },
    { metric: "Completion", score: completionRate ?? 0 },
    { metric: "Snooze reduction", score: snoozeReduction ?? 0 },
    { metric: "Habit", score: habitScore ?? 0 },
  ];

  const timelineData = challenges.slice(-7).map((challenge, index) => {
    const correct = challenge.is_correct === true || challenge.isCorrect === true;
    return { name: `Test ${index + 1}`, score: correct ? 100 : 0 };
  });

  return (
    <PageShell
      eyebrow="Intelligence Reports"
      title="Cognitive Analytics & Trends"
      subtitle="Examine your cognitive responsiveness, habit formation progress, and wake metrics."
      onBack={onBack}
      backLabel="← Dashboard"
      action={
        <div className="report-export-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleDownloadReport("pdf")}
            disabled={downloading}
            title="Download your habit, sleep, challenge, and wake-up report as PDF"
          >
            {downloading ? "Generating..." : "📄 Export PDF"}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleDownloadReport("excel")}
            disabled={downloading}
            title="Download your alarm and response dataset as Excel"
          >
            {downloading ? "Generating..." : "📊 Export Excel"}
          </button>
        </div>
      }
    >
      {/* STAT CARDS */}
      <div style={statGrid}>
        <StatCard
          icon="🧠"
          label="Habit Score"
          value={habitScore === null ? "—" : `${habitScore}%`}
          accent={COLORS.primary}
        />
        <StatCard
          icon="🎯"
          label="Average Accuracy"
          value={accuracy === null && answeredChallenges.length === 0 ? "—" : `${calculatedAccuracy}%`}
          accent={COLORS.cyan}
        />
        <StatCard
          icon="⏰"
          label="Completion Rate"
          value={completionRate === null ? "—" : `${completionRate}%`}
          accent={COLORS.emerald}
        />
        <StatCard
          icon="🔥"
          label="Test Sessions"
          value={challengeSessionCount || "—"}
          accent={COLORS.amber}
        />
      </div>

      {/* CHART GRID */}
      <div style={twoColGrid}>
        <Card title="Performance Indices" subtitle="Benchmark of your key morning alertness indicators" wide>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={performanceChartData} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} unit="%" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="score" radius={[4, 4, 0, 0]} fill={COLORS.primary} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Challenge Category Distribution" subtitle="Distribution of solved wake puzzles">
          {typeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={typeChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="rgba(8, 11, 19, 0.8)"
                >
                  {typeChartData.map((_, index) => (
                    <Cell key={index} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon="🧩" title="No category data" description="Complete challenges to see category distribution." />
          )}
        </Card>

        <Card title="Cognitive Balance Map" subtitle="Multi-axis evaluation of wake readiness">
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={readinessData} outerRadius="70%">
              <PolarGrid stroke={gridStroke} />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Radar
                dataKey="score"
                stroke={COLORS.cyan}
                fill={COLORS.cyan}
                fillOpacity={0.25}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Recent Challenge Timeline" subtitle="Performance across the last 7 wake tests" wide>
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timelineData} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} unit="%" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={COLORS.cyan}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: COLORS.primary }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon="📈" title="No timeline data" description="Complete wake challenges to populate your history." />
          )}
        </Card>

        <Card title="Detailed Performance Breakdown">
          <MetricRow label="Problem-Solving Accuracy" value={calculatedAccuracy} color={COLORS.cyan} />
          <MetricRow label="Alarm Completion Consistency" value={completionRate} color={COLORS.primary} />
          <MetricRow label="Snooze Reduction Index" value={snoozeReduction} color={COLORS.rose} />
          <MetricRow label="Overall Habit Score" value={habitScore} color={COLORS.emerald} />
        </Card>

        <Card>
          <div style={{ textAlign: "center", padding: "16px 8px" }}>
            <div style={{ fontSize: 38, marginBottom: 8 }}>🏆</div>
            <h3 style={{ color: "#fff", fontSize: 18, marginBottom: 6, fontFamily: "'Space Grotesk', sans-serif" }}>
              {calculatedAccuracy >= 80
                ? "Excellent Cognitive Focus"
                : calculatedAccuracy >= 60
                ? "Solid Morning Routine"
                : "Building Daily Momentum"}
            </h3>
            <p style={{ color: "#94a3b8", fontSize: 13, maxWidth: 360, margin: "0 auto 16px", lineHeight: 1.5 }}>
              {calculatedAccuracy >= 80
                ? "Your morning alertness is sharp. Continue completing challenges upon first ring to reinforce neurological wakefulness."
                : calculatedAccuracy >= 60
                ? "Good routine adherence. Consider shifting difficulty to Hard as your response time improves."
                : "Consistently answering morning puzzles helps reduce sleep inertia and builds long-term focus habits."}
            </p>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 36,
                fontWeight: 700,
                color: COLORS.cyan,
              }}
            >
              {calculatedAccuracy}%
            </div>
            <span style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>
              Wake Accuracy Rating
            </span>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

export default Results;
