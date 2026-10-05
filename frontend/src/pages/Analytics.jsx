
import { useEffect, useState } from "react";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
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
  Title,
  Tooltip,
  Legend
);

function Analytics() {
  const API_URL = "http://127.0.0.1:8000";

  const email =
    localStorage.getItem("email") ||
    "kavin_new2026@gmail.com";

  const [analytics, setAnalytics] = useState(null);
  const [habitScore, setHabitScore] = useState(null);
  const [adaptive, setAdaptive] = useState(null);
  const [recommendations, setRecommendations] = useState(null);

  const [wakeHistory, setWakeHistory] = useState([]);
  const [challengeHistory, setChallengeHistory] = useState([]);

  const [sleepHistory, setSleepHistory] = useState([]);
  const [sleepAnalytics, setSleepAnalytics] = useState(null);

  const [dashboard, setDashboard] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =====================================================
  // LOAD ANALYTICS
  // =====================================================

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    setError("");

    try {
      const encodedEmail = encodeURIComponent(email);

      const endpoints = [
        ["analytics", `${API_URL}/analytics/${encodedEmail}`],
        ["habit", `${API_URL}/habit-score/${encodedEmail}`],
        ["adaptive", `${API_URL}/adaptive-difficulty/${encodedEmail}`],
        ["recommendations", `${API_URL}/recommendations/${encodedEmail}`],
        ["wake", `${API_URL}/wake-up/history/${encodedEmail}`],
        ["challenge", `${API_URL}/challenges/history/${encodedEmail}`],
        ["sleepHistory", `${API_URL}/sleep/history/${encodedEmail}`],
        ["sleepAnalytics", `${API_URL}/sleep/analytics/${encodedEmail}`],
        ["dashboard", `${API_URL}/dashboard/${encodedEmail}`],
      ];

      const results = await Promise.all(
        endpoints.map(async ([name, url]) => {
          try {
            const response = await fetch(url);
            const data = await response.json();

            return {
              name,
              ok: response.ok,
              data,
            };
          } catch (err) {
            console.error(`${name} request failed`, err);

            return {
              name,
              ok: false,
              data: {},
            };
          }
        })
      );

      const getResult = (name) =>
        results.find((item) => item.name === name);

      const analyticsResult = getResult("analytics");
      const habitResult = getResult("habit");
      const adaptiveResult = getResult("adaptive");
      const recommendationResult = getResult("recommendations");
      const wakeResult = getResult("wake");
      const challengeResult = getResult("challenge");
      const sleepHistoryResult = getResult("sleepHistory");
      const sleepAnalyticsResult = getResult("sleepAnalytics");
      const dashboardResult = getResult("dashboard");

      if (!analyticsResult?.ok) {
        throw new Error(
          analyticsResult?.data?.detail ||
            "Could not load analytics"
        );
      }

      setAnalytics(analyticsResult.data);

      if (habitResult?.ok) {
        setHabitScore(habitResult.data);
      }

      if (adaptiveResult?.ok) {
        setAdaptive(adaptiveResult.data);
      }

      if (recommendationResult?.ok) {
        setRecommendations(
          recommendationResult.data
        );
      }

      if (wakeResult?.ok) {
        setWakeHistory(
          wakeResult.data?.history || []
        );
      }

      if (challengeResult?.ok) {
        setChallengeHistory(
          challengeResult.data?.history || []
        );
      }

      if (sleepHistoryResult?.ok) {
        setSleepHistory(
          sleepHistoryResult.data?.history || []
        );
      }

      if (sleepAnalyticsResult?.ok) {
        setSleepAnalytics(
          sleepAnalyticsResult.data
        );
      }

      if (dashboardResult?.ok) {
        setDashboard(dashboardResult.data);
      }
    } catch (err) {
      console.error(
        "Analytics loading error:",
        err
      );

      setError(
        "Could not load analytics. Make sure FastAPI is running on port 8000."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // DOWNLOAD REPORT
  // =====================================================

  const downloadReport = async () => {
    try {
      const encodedEmail =
        encodeURIComponent(email);

      const response = await fetch(
        `${API_URL}/analytics/report/${encodedEmail}`
      );

      if (!response.ok) {
        throw new Error(
          "Could not generate report"
        );
      }

      const report = await response.text();

      const blob = new Blob(
        [report],
        {
          type: "text/plain;charset=utf-8",
        }
      );

      const url =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        "COGNIA_Analytics_Report.txt";

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(
        "Report download error:",
        err
      );

      alert(
        "Could not download analytics report."
      );
    }
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={heroStyle}>
          <div>
            <p style={eyebrowStyle}>
              COGNIA INTELLIGENCE
            </p>

            <h1 style={mainTitleStyle}>
              Smart Analytics
            </h1>

            <p style={secondaryTextStyle}>
              Loading your behavioral intelligence...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // ERROR
  // =====================================================

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={heroStyle}>
          <div>
            <p style={eyebrowStyle}>
              COGNIA INTELLIGENCE
            </p>

            <h1 style={mainTitleStyle}>
              Smart Analytics
            </h1>
          </div>
        </div>

        <div
          style={{
            ...cardStyle,
            maxWidth: "700px",
            margin: "0 auto",
          }}
        >
          <h2>
            Unable to load analytics
          </h2>

          <p style={secondaryTextStyle}>
            {error}
          </p>

          <div style={heroButtonGroupStyle}>
            <button
              onClick={loadAnalytics}
              style={refreshButtonStyle}
            >
              🔄 Refresh
            </button>

            <button
              onClick={downloadReport}
              style={downloadButtonStyle}
            >
              📄 Download Report
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // SAFE NUMBER HELPER
  // =====================================================

  const numberValue = (
    value,
    fallback = 0
  ) => {
    const n = Number(value);

    return Number.isFinite(n)
      ? n
      : fallback;
  };

  // =====================================================
  // ANALYTICS VALUES
  // =====================================================

  const totalChallenges =
    numberValue(
      analytics?.total_challenges,
      numberValue(
        dashboard?.summary?.total_challenges,
        challengeHistory.length
      )
    );

  const correctAnswers =
    numberValue(
      analytics?.correct,
      challengeHistory.filter(
        (item) => item.correct === true
      ).length
    );

  const incorrectAnswers =
    numberValue(
      analytics?.incorrect,
      Math.max(
        totalChallenges - correctAnswers,
        0
      )
    );

  const accuracy =
    numberValue(
      analytics?.accuracy,
      totalChallenges > 0
        ? (correctAnswers /
            totalChallenges) *
            100
        : 0
    );

  const habit =
    numberValue(
      habitScore?.habit_score,
      numberValue(
        dashboard?.summary?.habit_score,
        0
      )
    );

  const wakeConsistency =
    numberValue(
      habitScore?.components
        ?.wake_up_consistency,
      0
    );

  const challengeCompletion =
    numberValue(
      habitScore?.components
        ?.challenge_completion,
      0
    );

  const snoozeReduction =
    numberValue(
      habitScore?.components
        ?.snooze_reduction,
      0
    );

  const sleepAdherence =
    numberValue(
      habitScore?.components
        ?.sleep_schedule_adherence,
      numberValue(
        dashboard?.summary
          ?.sleep_adherence,
        0
      )
    );

  // =====================================================
  // IMPORTANT:
  // GET VALUES FROM DASHBOARD OR CALCULATE THEM
  // =====================================================

  const dashboardSummary =
    dashboard?.summary || {};

  const totalAlarms =
    numberValue(
      dashboardSummary.total_alarms,
      numberValue(
        dashboard?.total_alarms,
        0
      )
    );

  const activeAlarms =
    numberValue(
      dashboardSummary.active_alarms,
      numberValue(
        dashboard?.active_alarms,
        0
      )
    );

  const snoozeCount =
    numberValue(
      dashboardSummary.snooze_count,
      numberValue(
        dashboard?.snooze_count,
        0
      )
    );

  const totalWakeups =
    numberValue(
      dashboardSummary.total_wakeups,
      wakeHistory.length
    );

  // Wake success:
  // If backend gives it, use it.
  // Otherwise calculate from wake history.

  const successfulWakeups =
    wakeHistory.filter(
      (item) => item.verified === true
    ).length;

  const calculatedWakeSuccess =
    totalWakeups > 0
      ? (successfulWakeups /
          totalWakeups) *
        100
      : 0;

  const wakeSuccess =
    numberValue(
      dashboardSummary.wake_up_success_rate,
      calculatedWakeSuccess
    );

  // =====================================================
  // OVERALL SCORE
  // =====================================================

  const calculatedOverall =
    (
      Number(habit) +
      Number(accuracy) +
      Number(wakeSuccess) +
      Number(sleepAdherence)
    ) / 4;

  const overallScore =
    numberValue(
      dashboardSummary.overall_score,
      calculatedOverall
    );

  // =====================================================
  // ADAPTIVE INTELLIGENCE
  // =====================================================

  const nextDifficulty =
    adaptive?.next_difficulty ||
    adaptive?.new_difficulty ||
    "Easy";

  const model =
    adaptive?.model ||
    "Decision Tree Classifier";

  const confidence =
    numberValue(
      adaptive?.confidence,
      0
    );

  const attemptsAnalyzed =
    numberValue(
      adaptive?.attempts_analyzed,
      numberValue(
        adaptive?.total_challenges,
        totalChallenges
      )
    );

  const adaptiveAccuracy =
    numberValue(
      adaptive?.accuracy,
      accuracy
    );

  // =====================================================
  // SLEEP VALUES
  // =====================================================

  const totalSleepRecords =
    sleepHistory.length;

  const latestSleep =
    sleepHistory.length > 0
      ? sleepHistory[0]
      : null;

  const averageSleepHours =
    numberValue(
      sleepAnalytics?.average_sleep_hours,
      numberValue(
        sleepAnalytics?.average_sleep_duration,
        numberValue(
          latestSleep?.actual_sleep_hours,
          0
        )
      )
    );

  const averageSleepAdherence =
    numberValue(
      sleepAnalytics?.average_sleep_adherence,
      numberValue(
        sleepAnalytics?.sleep_adherence,
        numberValue(
          latestSleep?.sleep_adherence,
          sleepAdherence
        )
      )
    );

  const targetSleepHours =
    numberValue(
      sleepAnalytics?.target_sleep_hours,
      numberValue(
        latestSleep?.target_sleep_hours,
        8
      )
    );

  const sleepQuality =
    numberValue(
      sleepAnalytics?.average_quality,
      numberValue(
        sleepAnalytics?.quality,
        0
      )
    );

  // =====================================================
  // CHART DATA
  // =====================================================

  const performanceChartData = {
    labels: [
      "Overall",
      "Challenge",
      "Wake-up",
      "Habit",
    ],

    datasets: [
      {
        label: "Performance %",
        data: [
          overallScore,
          accuracy,
          wakeSuccess,
          habit,
        ],

        borderRadius: 10,
      },
    ],
  };

  const performanceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      legend: {
        display: false,
      },
    },

    scales: {
      y: {
        beginAtZero: true,
        max: 100,

        ticks: {
          callback: (value) =>
            `${value}%`,
        },
      },
    },
  };

  const challengeChartData = {
    labels: [
      "Correct",
      "Incorrect",
    ],

    datasets: [
      {
        label: "Challenge Attempts",

        data: [
          correctAnswers,
          incorrectAnswers,
        ],

        borderWidth: 0,
      },
    ],
  };

  const challengeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      legend: {
        position: "bottom",
      },
    },
  };

  const habitChartData = {
    labels: [
      "Wake-up Consistency",
      "Challenge Completion",
      "Snooze Reduction",
      "Sleep Adherence",
    ],

    datasets: [
      {
        label: "Habit Components",

        data: [
          wakeConsistency,
          challengeCompletion,
          snoozeReduction,
          sleepAdherence,
        ],

        borderRadius: 8,
      },
    ],
  };

  const habitChartOptions = {
    indexAxis: "y",

    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      legend: {
        display: false,
      },
    },

    scales: {
      x: {
        beginAtZero: true,
        max: 100,

        ticks: {
          callback: (value) =>
            `${value}%`,
        },
      },
    },
  };

  // =====================================================
  // CHALLENGE TREND
  // =====================================================

  const recentChallengeHistory =
    [...challengeHistory]
      .reverse()
      .slice(-10);

  const challengeTrendData = {
    labels:
      recentChallengeHistory.map(
        (_, index) =>
          `Attempt ${index + 1}`
      ),

    datasets: [
      {
        label: "Accuracy",

        data:
          recentChallengeHistory.map(
            (item) =>
              item.correct ? 100 : 0
          ),

        tension: 0.35,
        fill: false,
      },
    ],
  };

  const challengeTrendOptions = {
    responsive: true,
    maintainAspectRatio: false,

    scales: {
      y: {
        beginAtZero: true,
        max: 100,

        ticks: {
          callback: (value) =>
            `${value}%`,
        },
      },
    },
  };

  // =====================================================
  // WAKE TREND
  // =====================================================

  const recentWakeHistory =
    wakeHistory
      .slice()
      .reverse()
      .slice(-10);

  const wakeTrendData = {
    labels:
      recentWakeHistory.map(
        (_, index) =>
          `Wake-up ${index + 1}`
      ),

    datasets: [
      {
        label: "Successful",

        data:
          recentWakeHistory.map(
            (item) =>
              item.verified ? 100 : 0
          ),

        tension: 0.35,
        fill: false,
      },
    ],
  };

  const wakeTrendOptions = {
    responsive: true,
    maintainAspectRatio: false,

    scales: {
      y: {
        beginAtZero: true,
        max: 100,

        ticks: {
          callback: (value) =>
            `${value}%`,
        },
      },
    },
  };

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div style={pageStyle}>

      {/* HERO */}

      <div style={heroStyle}>

        <div>
          <p style={eyebrowStyle}>
            COGNIA INTELLIGENCE
          </p>

          <h1 style={mainTitleStyle}>
            Smart Analytics
          </h1>

          <p style={secondaryTextStyle}>
            Your complete wake-up, cognitive,
            sleep and habit intelligence dashboard.
          </p>

          <p style={userTextStyle}>
            User: {email}
          </p>
        </div>

        <div style={heroButtonGroupStyle}>

          <button
            onClick={loadAnalytics}
            style={refreshButtonStyle}
          >
            🔄 Refresh
          </button>

          <button
            onClick={downloadReport}
            style={downloadButtonStyle}
          >
            📄 Download Report
          </button>

        </div>

      </div>

      {/* EXECUTIVE KPI */}

      <section style={sectionStyle}>

        <div style={gridStyle}>

          <KpiCard
            icon="📊"
            title="Overall Score"
            value={`${overallScore.toFixed(2)}%`}
            subtitle="COGNIA performance"
          />

          <KpiCard
            icon="⏰"
            title="Wake-up Success"
            value={`${wakeSuccess.toFixed(0)}%`}
            subtitle="Successful wake-ups"
          />

          <KpiCard
            icon="🧠"
            title="Challenge Accuracy"
            value={`${accuracy.toFixed(0)}%`}
            subtitle={`${totalChallenges} challenges`}
          />

          <KpiCard
            icon="🔔"
            title="Total Alarms"
            value={totalAlarms}
            subtitle={`${activeAlarms} active`}
          />

          <KpiCard
            icon="🌱"
            title="Habit Score"
            value={`${habit.toFixed(2)}%`}
            subtitle="Routine consistency"
          />

          <KpiCard
            icon="🔕"
            title="Snoozes"
            value={snoozeCount}
            subtitle="Recorded snoozes"
          />

        </div>

      </section>

      {/* PERFORMANCE */}

      <section style={sectionStyle}>

        <h2 style={sectionTitleStyle}>
          📊 Performance Overview
        </h2>

        <div style={largeChartCardStyle}>

          <h3>
            Overall COGNIA Performance
          </h3>

          <p style={secondaryTextStyle}>
            Comparison of your main intelligence
            and habit metrics.
          </p>

          <div style={chartContainerStyle}>

            <Bar
              data={performanceChartData}
              options={performanceChartOptions}
            />

          </div>

        </div>

      </section>

      {/* CHALLENGES */}

      <section style={sectionStyle}>

        <h2 style={sectionTitleStyle}>
          🧠 Cognitive Challenge Analytics
        </h2>

        <div style={twoColumnStyle}>

          <div style={cardStyle}>

            <h3>
              Challenge Results
            </h3>

            <div style={smallChartStyle}>

              <Doughnut
                data={challengeChartData}
                options={challengeChartOptions}
              />

            </div>

            <div style={miniStatsGrid}>

              <div>
                <p style={labelStyle}>
                  CORRECT
                </p>

                <strong
                  style={greenValueStyle}
                >
                  {correctAnswers}
                </strong>
              </div>

              <div>
                <p style={labelStyle}>
                  INCORRECT
                </p>

                <strong
                  style={redValueStyle}
                >
                  {incorrectAnswers}
                </strong>
              </div>

              <div>
                <p style={labelStyle}>
                  ACCURACY
                </p>

                <strong>
                  {accuracy.toFixed(0)}%
                </strong>
              </div>

            </div>

          </div>

          <div style={cardStyle}>

            <h3>
              📈 Challenge Trend
            </h3>

            <p style={secondaryTextStyle}>
              Recent cognitive challenge performance.
            </p>

            <div style={chartContainerStyle}>

              {recentChallengeHistory.length > 0 ? (

                <Line
                  data={challengeTrendData}
                  options={challengeTrendOptions}
                />

              ) : (

                <EmptyChartMessage
                  text="Complete challenges to generate your performance trend."
                />

              )}

            </div>

          </div>

        </div>

      </section>

      {/* HABIT */}

      <section style={sectionStyle}>

        <h2 style={sectionTitleStyle}>
          🌱 Behavioral Habit Intelligence
        </h2>

        <div style={twoColumnStyle}>

          <div style={cardStyle}>

            <p style={labelStyle}>
              OVERALL HABIT SCORE
            </p>

            <h1 style={largeScoreStyle}>
              {habit.toFixed(2)}%
            </h1>

            <p style={secondaryTextStyle}>
              Weighted habit formation score.
            </p>

            <div style={progressOuterStyle}>

              <div
                style={{
                  ...progressInnerStyle,

                  width: `${Math.min(
                    habit,
                    100
                  )}%`,
                }}
              />

            </div>

          </div>

          <div style={cardStyle}>

            <h3>
              Habit Components
            </h3>

            <div
              style={
                habitChartContainerStyle
              }
            >

              <Bar
                data={habitChartData}
                options={habitChartOptions}
              />

            </div>

          </div>

        </div>

      </section>

      {/* WAKE-UP */}

      <section style={sectionStyle}>

        <h2 style={sectionTitleStyle}>
          ⏰ Wake-up Analytics
        </h2>

        <div style={twoColumnStyle}>

          <div style={cardStyle}>

            <h3>
              Wake-up Success
            </h3>

            <div style={chartContainerStyle}>

              {recentWakeHistory.length > 0 ? (

                <Line
                  data={wakeTrendData}
                  options={wakeTrendOptions}
                />

              ) : (

                <EmptyChartMessage
                  text="Complete a wake-up verification to generate wake-up analytics."
                />

              )}

            </div>

          </div>

          <div style={cardStyle}>

            <h3>
              Wake-up Statistics
            </h3>

            <StatRow
              label="Total Wake-ups"
              value={totalWakeups}
            />

            <StatRow
              label="Successful Wake-ups"
              value={`${wakeSuccess.toFixed(0)}%`}
            />

            <StatRow
              label="Snooze Count"
              value={snoozeCount}
            />

            <StatRow
              label="Wake-up Consistency"
              value={`${wakeConsistency.toFixed(0)}%`}
            />

          </div>

        </div>

      </section>

      {/* SLEEP */}

      <section style={sectionStyle}>

        <h2 style={sectionTitleStyle}>
          😴 Sleep Analytics
        </h2>

        <div style={gridStyle}>

          <KpiCard
            icon="🛏️"
            title="Sleep Records"
            value={totalSleepRecords}
            subtitle="Recorded sessions"
          />

          <KpiCard
            icon="⏱️"
            title="Average Sleep"
            value={`${averageSleepHours} hrs`}
            subtitle={`Target: ${targetSleepHours} hrs`}
          />

          <KpiCard
            icon="📈"
            title="Sleep Adherence"
            value={`${averageSleepAdherence}%`}
            subtitle="Schedule consistency"
          />

          <KpiCard
            icon="⭐"
            title="Sleep Quality"
            value={
              sleepQuality > 0
                ? `${sleepQuality}%`
                : "N/A"
            }
            subtitle="Recorded quality"
          />

        </div>

        <div
          style={{
            ...cardStyle,
            marginTop: "20px",
          }}
        >

          <h3>
            🌙 Latest Sleep Session
          </h3>

          {latestSleep ? (

            <div style={sleepDetailGrid}>

              <DetailItem
                label="Sleep Time"
                value={
                  latestSleep.sleep_time ||
                  "N/A"
                }
              />

              <DetailItem
                label="Wake-up Time"
                value={
                  latestSleep.wake_up_time ||
                  "N/A"
                }
              />

              <DetailItem
                label="Actual Sleep"
                value={`${latestSleep.actual_sleep_hours ?? 0} hours`}
              />

              <DetailItem
                label="Target Sleep"
                value={`${latestSleep.target_sleep_hours ?? 0} hours`}
              />

              <DetailItem
                label="Adherence"
                value={`${latestSleep.sleep_adherence ?? 0}%`}
              />

              <DetailItem
                label="Recorded At"
                value={
                  latestSleep.recorded_at ||
                  "N/A"
                }
              />

            </div>

          ) : (

            <p style={secondaryTextStyle}>
              No sleep record available yet.
            </p>

          )}

        </div>

      </section>

      {/* ADAPTIVE AI */}

      <section style={sectionStyle}>

        <h2 style={sectionTitleStyle}>
          🤖 Adaptive Intelligence
        </h2>

        <div style={adaptiveCardStyle}>

          <div>

            <p style={labelStyle}>
              NEXT COGNITIVE DIFFICULTY
            </p>

            <h1 style={difficultyStyle}>
              {nextDifficulty}
            </h1>

            <p style={secondaryTextStyle}>
              {adaptive?.reason ||
                "COGNIA adjusts challenge difficulty using behavioral performance."}
            </p>

          </div>

          <div style={aiStatsGrid}>

            <DetailItem
              label="ML Model"
              value={model}
            />

            <DetailItem
              label="Confidence"
              value={`${confidence}%`}
            />

            <DetailItem
              label="Model Accuracy"
              value={`${adaptiveAccuracy}%`}
            />

            <DetailItem
              label="Attempts Analyzed"
              value={attemptsAnalyzed}
            />

            {adaptive?.completion_rate !==
              undefined && (

              <DetailItem
                label="Completion Rate"
                value={`${adaptive.completion_rate}%`}
              />

            )}

            {adaptive?.snooze_count !==
              undefined && (

              <DetailItem
                label="Snooze Count"
                value={
                  adaptive.snooze_count
                }
              />

            )}

          </div>

        </div>

      </section>

      {/* SLEEP HISTORY */}

      <section style={sectionStyle}>

        <h2 style={sectionTitleStyle}>
          💤 Sleep History
        </h2>

        {sleepHistory.length === 0 ? (

          <div style={cardStyle}>

            <p style={secondaryTextStyle}>
              No sleep history available.
            </p>

          </div>

        ) : (

          sleepHistory.map(
            (item, index) => (

              <div
                key={index}
                style={{
                  ...cardStyle,
                  marginBottom: "15px",
                }}
              >

                <h3>
                  🌙 Sleep Session #
                  {index + 1}
                </h3>

                <div
                  style={
                    sleepHistoryGrid
                  }
                >

                  <DetailItem
                    label="Sleep Time"
                    value={
                      item.sleep_time ||
                      "N/A"
                    }
                  />

                  <DetailItem
                    label="Wake-up Time"
                    value={
                      item.wake_up_time ||
                      "N/A"
                    }
                  />

                  <DetailItem
                    label="Actual Sleep"
                    value={`${item.actual_sleep_hours ?? 0} hours`}
                  />

                  <DetailItem
                    label="Target Sleep"
                    value={`${item.target_sleep_hours ?? 0} hours`}
                  />

                  <DetailItem
                    label="Adherence"
                    value={`${item.sleep_adherence ?? 0}%`}
                  />

                  <DetailItem
                    label="Recorded At"
                    value={
                      item.recorded_at ||
                      "N/A"
                    }
                  />

                </div>

              </div>

            )
          )

        )}

      </section>

      {/* WAKE HISTORY */}

      <section style={sectionStyle}>

        <h2 style={sectionTitleStyle}>
          ⏰ Wake-up History
        </h2>

        {wakeHistory.length === 0 ? (

          <div style={cardStyle}>

            <p style={secondaryTextStyle}>
              No wake-up history available.
            </p>

          </div>

        ) : (

          wakeHistory.map(
            (item, index) => (

              <div
                key={index}
                style={{
                  ...cardStyle,
                  marginBottom: "15px",
                }}
              >

                <h3>
                  ⏰ Wake-up #{index + 1}
                </h3>

                <div style={historyGrid}>

                  <DetailItem
                    label="Verified"
                    value={
                      item.verified
                        ? "✓ Yes"
                        : "✕ No"
                    }
                  />

                  <DetailItem
                    label="Snoozed"
                    value={
                      item.snoozed
                        ? "Yes"
                        : "No"
                    }
                  />

                  <DetailItem
                    label="Snooze Count"
                    value={
                      item.snooze_count ??
                      0
                    }
                  />

                  <DetailItem
                    label="Wake-up Time"
                    value={
                      item.wake_up_time ||
                      "N/A"
                    }
                  />

                  <DetailItem
                    label="Scheduled Time"
                    value={
                      item.scheduled_time ||
                      "N/A"
                    }
                  />

                  <DetailItem
                    label="Created"
                    value={
                      item.created_at ||
                      "N/A"
                    }
                  />

                </div>

              </div>

            )
          )

        )}

      </section>

      {/* CHALLENGE HISTORY */}

      <section style={sectionStyle}>

        <h2 style={sectionTitleStyle}>
          📚 Recent Challenge History
        </h2>

        {challengeHistory.length === 0 ? (

          <div style={cardStyle}>

            <p style={secondaryTextStyle}>
              No challenge history available.
            </p>

          </div>

        ) : (

          challengeHistory.map(
            (item, index) => (

              <div
                key={index}
                style={{
                  ...cardStyle,
                  marginBottom: "15px",
                }}
              >

                <h3>
                  🧩{" "}
                  {item.challenge_type ||
                    item.type ||
                    "Challenge"}
                </h3>

                <p style={normalTextStyle}>
                  {item.question ||
                    "No question recorded"}
                </p>

                <div style={historyGrid}>

                  <DetailItem
                    label="Difficulty"
                    value={
                      item.difficulty ||
                      "N/A"
                    }
                  />

                  <DetailItem
                    label="Result"
                    value={
                      item.correct
                        ? "✓ Completed"
                        : "✕ Incorrect"
                    }
                  />

                  <DetailItem
                    label="Completion Time"
                    value={`${item.completion_time_seconds ?? 0} seconds`}
                  />

                  <DetailItem
                    label="Completed At"
                    value={
                      item.completed_at ||
                      "N/A"
                    }
                  />

                </div>

              </div>

            )
          )

        )}

      </section>

      {/* RECOMMENDATIONS */}

      <section
        style={{
          ...sectionStyle,
          paddingBottom: "60px",
        }}
      >

        <h2 style={sectionTitleStyle}>
          🤖 COGNIA AI Recommendations
        </h2>

        <div style={cardStyle}>

          {recommendations?.recommendations
            ?.length > 0 ? (

            recommendations.recommendations.map(
              (recommendation, index) => (

                <div
                  key={index}
                  style={{
                    padding: "18px 0",

                    borderBottom:
                      index !==
                      recommendations
                        .recommendations
                        .length -
                        1
                        ? "1px solid #e5e7eb"
                        : "none",
                  }}
                >

                  💡{" "}

                  <span
                    style={{
                      color: "#374151",
                    }}
                  >
                    {recommendation}
                  </span>

                </div>

              )
            )

          ) : (

            <p style={secondaryTextStyle}>
              No recommendations available yet.
            </p>

          )}

        </div>

      </section>

      {/* MILESTONE 4 */}

      <section
        style={{
          ...sectionStyle,
          paddingBottom: "120px",
        }}
      >

        <div style={milestoneCardStyle}>

          <p style={eyebrowStyle}>
            MILESTONE 4
          </p>

          <h2>
            🚀 Analytics & Intelligence
          </h2>

          <div style={statusGrid}>

            <StatusItem
              label="Executive Analytics"
              status="Operational"
            />

            <StatusItem
              label="Behavioral Analytics"
              status="Operational"
            />

            <StatusItem
              label="Adaptive Intelligence"
              status="Operational"
            />

            <StatusItem
              label="Wake-up Analytics"
              status="Operational"
            />

            <StatusItem
              label="Sleep Analytics"
              status="Operational"
            />

            <StatusItem
              label="Visualization"
              status="Operational"
            />

            <StatusItem
              label="Reporting"
              status="Operational"
            />

            <StatusItem
              label="Docker Deployment"
              status="Upcoming"
              pending
            />

          </div>

        </div>

      </section>

    </div>
  );
}

// =====================================================
// COMPONENTS
// =====================================================

function KpiCard({
  icon,
  title,
  value,
  subtitle,
}) {
  return (
    <div style={cardStyle}>

      <div style={iconStyle}>
        {icon}
      </div>

      <p style={labelStyle}>
        {title}
      </p>

      <h2 style={numberStyle}>
        {value}
      </h2>

      <p style={secondaryTextStyle}>
        {subtitle}
      </p>

    </div>
  );
}

function DetailItem({
  label,
  value,
}) {
  return (
    <div>

      <p style={labelStyle}>
        {label}
      </p>

      <strong
        style={{
          color: "#111827",
          fontSize: "15px",
        }}
      >
        {value}
      </strong>

    </div>
  );
}

function StatRow({
  label,
  value,
}) {
  return (
    <div style={statRowStyle}>

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}

function EmptyChartMessage({
  text,
}) {
  return (
    <div style={emptyChartStyle}>

      <div style={{ fontSize: "35px" }}>
        📊
      </div>

      <p>
        {text}
      </p>

    </div>
  );
}

function StatusItem({
  label,
  status,
  pending = false,
}) {
  return (
    <div style={statusItemStyle}>

      <span>
        {pending ? "⏳" : "✅"}
      </span>

      <div>

        <strong>
          {label}
        </strong>

        <p
          style={{
            margin: "4px 0 0",

            color: pending
              ? "#b45309"
              : "#15803d",

            fontSize: "13px",
          }}
        >
          {status}
        </p>

      </div>

    </div>
  );
}

// =====================================================
// STYLES
// =====================================================

const pageStyle = {
  minHeight: "100vh",

  background:
    "linear-gradient(180deg, #f8fbff 0%, #f3f6fb 100%)",

  padding: "40px",

  fontFamily:
    "Inter, Arial, sans-serif",

  color: "#111827",
};

const heroStyle = {
  maxWidth: "1150px",

  margin: "0 auto 35px",

  display: "flex",

  justifyContent:
    "space-between",

  alignItems:
    "flex-start",

  gap: "20px",

  flexWrap: "wrap",
};

const eyebrowStyle = {
  color: "#2563eb",

  fontSize: "12px",

  fontWeight: "800",

  letterSpacing: "2px",

  marginBottom: "8px",
};

const mainTitleStyle = {
  fontSize: "38px",

  margin:
    "5px 0 10px",

  color: "#0f172a",
};

const userTextStyle = {
  color: "#64748b",

  fontSize: "13px",

  marginTop: "15px",
};

const sectionStyle = {
  maxWidth: "1150px",

  margin: "0 auto 40px",
};

const sectionTitleStyle = {
  color: "#0f172a",

  marginBottom: "20px",

  fontSize: "24px",
};

const cardStyle = {
  background: "#ffffff",

  padding: "24px",

  borderRadius: "18px",

  boxShadow:
    "0 8px 30px rgba(15,23,42,0.07)",

  border:
    "1px solid #e5e7eb",
};

const largeChartCardStyle = {
  ...cardStyle,

  padding: "28px",
};

const gridStyle = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(190px, 1fr))",

  gap: "18px",
};

const twoColumnStyle = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(330px, 1fr))",

  gap: "20px",
};

const iconStyle = {
  fontSize: "28px",

  marginBottom: "10px",
};

const labelStyle = {
  color: "#64748b",

  fontWeight: "800",

  fontSize: "11px",

  letterSpacing: "0.7px",

  marginBottom: "7px",
};

const numberStyle = {
  fontSize: "34px",

  margin: "5px 0",

  color: "#0f172a",
};

const largeScoreStyle = {
  fontSize: "54px",

  margin: "10px 0",

  color: "#2563eb",
};

const difficultyStyle = {
  fontSize: "44px",

  margin: "8px 0",

  color: "#2563eb",
};

const normalTextStyle = {
  color: "#374151",
};

const secondaryTextStyle = {
  color: "#64748b",

  lineHeight: "1.6",
};

const chartContainerStyle = {
  height: "300px",

  marginTop: "20px",
};

const smallChartStyle = {
  height: "260px",

  maxWidth: "300px",

  margin: "20px auto",
};

const habitChartContainerStyle = {
  height: "280px",

  marginTop: "15px",
};

const progressOuterStyle = {
  height: "12px",

  background: "#e5e7eb",

  borderRadius: "20px",

  overflow: "hidden",

  marginTop: "20px",
};

const progressInnerStyle = {
  height: "100%",

  background:
    "linear-gradient(90deg, #2563eb, #6366f1)",

  borderRadius: "20px",

  transition:
    "width 0.5s ease",
};

const miniStatsGrid = {
  display: "grid",

  gridTemplateColumns:
    "repeat(3, 1fr)",

  gap: "15px",

  marginTop: "15px",
};

const greenValueStyle = {
  color: "#15803d",

  fontSize: "22px",
};

const redValueStyle = {
  color: "#dc2626",

  fontSize: "22px",
};

const sleepDetailGrid = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",

  gap: "25px",

  marginTop: "20px",
};

const sleepHistoryGrid = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",

  gap: "20px",

  marginTop: "20px",
};

const historyGrid = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(170px, 1fr))",

  gap: "20px",

  marginTop: "18px",
};

const adaptiveCardStyle = {
  ...cardStyle,

  display: "grid",

  gridTemplateColumns:
    "minmax(250px, 1fr) 2fr",

  gap: "35px",

  alignItems: "center",
};

const aiStatsGrid = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",

  gap: "25px",

  padding: "20px",

  background: "#f8fafc",

  borderRadius: "15px",
};

const statRowStyle = {
  display: "flex",

  justifyContent:
    "space-between",

  alignItems: "center",

  padding: "17px 0",

  borderBottom:
    "1px solid #e5e7eb",

  color: "#475569",
};

const emptyChartStyle = {
  height: "100%",

  display: "flex",

  flexDirection: "column",

  justifyContent: "center",

  alignItems: "center",

  color: "#64748b",

  textAlign: "center",

  padding: "20px",
};

const refreshButtonStyle = {
  padding: "12px 18px",

  border: "none",

  borderRadius: "10px",

  cursor: "pointer",

  background: "#2563eb",

  color: "#ffffff",

  fontWeight: "700",

  boxShadow:
    "0 5px 15px rgba(37,99,235,0.2)",
};

const heroButtonGroupStyle = {
  display: "flex",

  gap: "12px",

  flexWrap: "wrap",
};

const downloadButtonStyle = {
  padding: "12px 18px",

  border: "none",

  borderRadius: "10px",

  cursor: "pointer",

  background: "#0f172a",

  color: "#ffffff",

  fontWeight: "700",

  boxShadow:
    "0 5px 15px rgba(15,23,42,0.15)",
};

const milestoneCardStyle = {
  ...cardStyle,

  background:
    "linear-gradient(135deg, #eff6ff, #ffffff)",
};

const statusGrid = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(210px, 1fr))",

  gap: "15px",

  marginTop: "25px",
};

const statusItemStyle = {
  display: "flex",

  alignItems: "center",

  gap: "12px",

  padding: "15px",

  background: "#ffffff",

  borderRadius: "12px",

  border:
    "1px solid #e5e7eb",
};

export default Analytics;


