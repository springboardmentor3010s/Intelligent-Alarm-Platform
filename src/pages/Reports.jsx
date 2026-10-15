import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getReportData, downloadReport, isDemoActive } from "../services/api";

function Reports() {
  const navigate = useNavigate();
  const isDemo = isDemoActive();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportingFormat, setExportingFormat] = useState(null);
  const [exportFeedback, setExportFeedback] = useState({ type: "", message: "" });

  async function loadReport() {
    try {
      setLoading(true);
      setError("");
      const data = await getReportData();
      setReport(data);
    } catch (err) {
      setError(err.message || "Failed to load report data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
  }, []);

  async function handleExport(format) {
    try {
      setExportingFormat(format);
      setExportFeedback({ type: "", message: "" });
      await downloadReport(format);
      setExportFeedback({
        type: "success",
        message: `${format.toUpperCase()} report exported and downloaded successfully!`,
      });
      setTimeout(() => {
        setExportFeedback({ type: "", message: "" });
      }, 5000);
    } catch (err) {
      setExportFeedback({
        type: "error",
        message: err.message || `Failed to export ${format.toUpperCase()} report.`,
      });
    } finally {
      setExportingFormat(null);
    }
  }

  const habit = report?.habit_report;
  const wake = report?.wake_up_report;
  const challenge = report?.challenge_report;
  const sleep = report?.sleep_adherence_report;
  const productivity = report?.productivity_report;

  function getHabitGrade(score) {
    if (score >= 80) return { label: "Excellent", color: "grade-excellent" };
    if (score >= 65) return { label: "Good", color: "grade-good" };
    if (score >= 50) return { label: "Fair", color: "grade-fair" };
    return { label: "Needs Improvement", color: "grade-poor" };
  }

  return (
    <div className="reports-page-wrapper">
      <Navbar />

      <main className="reports-container">
        {/* Demo Mode Notice Banner */}
        {isDemo && (
          <div className="reports-demo-banner" role="alert">
            <span className="demo-banner-icon">🎯</span>
            <div className="demo-banner-text">
              <strong>DEMO REPORT &mdash; SAMPLE DATA (READ-ONLY)</strong>
              <span>
                You are viewing simulated cognitive performance reports. No database records are modified.
              </span>
            </div>
          </div>
        )}

        {/* Page Header */}
        <header className="reports-header-card">
          <div className="reports-header-left">
            <span className="reports-pill-tag">ANALYTICS &amp; INSIGHTS</span>
            <h1 className="reports-main-title">Reports</h1>
            <p className="reports-subtitle">
              Generate and export your cognitive alarm performance reports.
            </p>

            {report && (
              <div className="reports-meta-bar">
                <span className="meta-badge">
                  👤 <strong>User:</strong> {report.user_name}
                </span>
                <span className="meta-badge">
                  ✉️ <strong>Email:</strong> {report.user_email}
                </span>
                <span className="meta-badge">
                  🕒 <strong>Generated:</strong> {report.generated_at}
                </span>
              </div>
            )}
          </div>

          {/* Export Action Controls */}
          <div className="reports-export-toolbar">
            <div className="export-buttons-group">
              <button
                type="button"
                className="export-btn export-btn-pdf"
                onClick={() => handleExport("pdf")}
                disabled={loading || exportingFormat !== null}
                title="Export report as PDF document"
              >
                <span className="btn-icon">📄</span>
                {exportingFormat === "pdf" ? "Exporting PDF..." : "Export PDF"}
              </button>

              <button
                type="button"
                className="export-btn export-btn-excel"
                onClick={() => handleExport("excel")}
                disabled={loading || exportingFormat !== null}
                title="Export report as multi-sheet Excel spreadsheet (.xlsx)"
              >
                <span className="btn-icon">📊</span>
                {exportingFormat === "excel" ? "Exporting Excel..." : "Export Excel"}
              </button>

              <button
                type="button"
                className="export-btn export-btn-csv"
                onClick={() => handleExport("csv")}
                disabled={loading || exportingFormat !== null}
                title="Export report as CSV spreadsheet (.csv)"
              >
                <span className="btn-icon">📑</span>
                {exportingFormat === "csv" ? "Exporting CSV..." : "Export CSV"}
              </button>
            </div>
          </div>
        </header>

        {/* Feedback Alert Toast */}
        {exportFeedback.message && (
          <div className={`export-feedback-toast ${exportFeedback.type}`}>
            <span>
              {exportFeedback.type === "success" ? "✓" : "⚠️"} {exportFeedback.message}
            </span>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => setExportFeedback({ type: "", message: "" })}
            >
              ✕
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="reports-loading-container">
            <div className="reports-spinner" />
            <p>Loading performance reports...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="reports-error-card">
            <h2>Unable to load report data</h2>
            <p>{error}</p>
            <button type="button" className="btn-retry" onClick={loadReport}>
              Try Again
            </button>
          </div>
        )}

        {/* Report Content */}
        {!loading && !error && report && (
          <div className="reports-sections-grid">
            {/* --------------------------------------------------------
                SECTION 1: HABIT REPORT
            -------------------------------------------------------- */}
            <section className="report-card habit-report-section" id="habit-report">
              <div className="report-card-header">
                <div className="card-title-group">
                  <span className="section-step-num">1</span>
                  <div>
                    <h2 className="report-card-title">Habit Performance Report</h2>
                    <p className="report-card-desc">
                      Official Milestone 3 evaluated habit metrics based on consistency, challenge completion, snooze reduction, and schedule adherence.
                    </p>
                  </div>
                </div>
                <div className="card-badge">Overall Score</div>
              </div>

              <div className="habit-score-hero">
                <div className="score-hero-circle">
                  <span className="score-number">{habit?.overall_habit_score?.toFixed(1) || "0.0"}</span>
                  <span className="score-denom">/ 100</span>
                  <span className={`score-tag ${getHabitGrade(habit?.overall_habit_score || 0).color}`}>
                    {getHabitGrade(habit?.overall_habit_score || 0).label}
                  </span>
                </div>

                <div className="habit-metrics-breakdown">
                  <div className="habit-sub-metric">
                    <div className="metric-header">
                      <span>Wake-Up Consistency (35%)</span>
                      <strong>{habit?.wake_up_consistency?.toFixed(1)}%</strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill fill-blue"
                        style={{ width: `${Math.min(habit?.wake_up_consistency || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="habit-sub-metric">
                    <div className="metric-header">
                      <span>Challenge Completion (25%)</span>
                      <strong>{habit?.challenge_completion?.toFixed(1)}%</strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill fill-purple"
                        style={{ width: `${Math.min(habit?.challenge_completion || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="habit-sub-metric">
                    <div className="metric-header">
                      <span>Snooze Reduction (20%)</span>
                      <strong>{habit?.snooze_reduction?.toFixed(1)} / 100</strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill fill-amber"
                        style={{ width: `${Math.min(habit?.snooze_reduction || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="habit-sub-metric">
                    <div className="metric-header">
                      <span>Sleep Schedule Adherence (20%)</span>
                      <strong>{habit?.sleep_schedule_adherence?.toFixed(1)}%</strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill fill-emerald"
                        style={{ width: `${Math.min(habit?.sleep_schedule_adherence || 0, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="habit-aux-stats">
                <div className="aux-stat-item">
                  <span className="aux-label">Sessions Evaluated</span>
                  <span className="aux-value">{habit?.sessions_evaluated || 0}</span>
                </div>
                <div className="aux-stat-item">
                  <span className="aux-label">Average Snoozes Per Session</span>
                  <span className="aux-value">{habit?.average_snooze_count?.toFixed(2) || "0.00"}</span>
                </div>
              </div>
            </section>

            {/* --------------------------------------------------------
                SECTION 2: WAKE-UP PERFORMANCE REPORT
            -------------------------------------------------------- */}
            <section className="report-card wake-report-section" id="wake-report">
              <div className="report-card-header">
                <div className="card-title-group">
                  <span className="section-step-num">2</span>
                  <div>
                    <h2 className="report-card-title">Wake-Up Performance Report</h2>
                    <p className="report-card-desc">
                      Session consistency, response speeds, successful alarm dismissals, and snooze frequency.
                    </p>
                  </div>
                </div>
              </div>

              <div className="kpi-cards-grid">
                <div className="kpi-mini-card">
                  <span className="kpi-icon">⏰</span>
                  <span className="kpi-label">Total Sessions</span>
                  <strong className="kpi-val">{wake?.total_sessions || 0}</strong>
                </div>

                <div className="kpi-mini-card">
                  <span className="kpi-icon">🎯</span>
                  <span className="kpi-label">Consistency</span>
                  <strong className="kpi-val">{wake?.wake_up_consistency?.toFixed(1) || "0.0"}%</strong>
                </div>

                <div className="kpi-mini-card">
                  <span className="kpi-icon">⚡</span>
                  <span className="kpi-label">Avg Response Time</span>
                  <strong className="kpi-val">{wake?.average_response_time?.toFixed(1) || "0.0"} s</strong>
                </div>

                <div className="kpi-mini-card">
                  <span className="kpi-icon">✅</span>
                  <span className="kpi-label">Successful Dismissals</span>
                  <strong className="kpi-val">{wake?.successful_dismissals || 0}</strong>
                </div>

                <div className="kpi-mini-card">
                  <span className="kpi-icon">💤</span>
                  <span className="kpi-label">Total Snoozes Used</span>
                  <strong className="kpi-val">{wake?.total_snoozes || 0}</strong>
                </div>
              </div>

              <div className="status-breakdown-box">
                <h3 className="sub-section-title">Session Status Breakdown</h3>
                <div className="status-pills-row">
                  {wake?.status_breakdown && Object.keys(wake.status_breakdown).length > 0 ? (
                    Object.entries(wake.status_breakdown).map(([status, count]) => (
                      <div key={status} className={`status-pill status-${status.toLowerCase()}`}>
                        <span className="pill-name">{status.toUpperCase()}</span>
                        <span className="pill-count">{count}</span>
                      </div>
                    ))
                  ) : (
                    <span className="no-data-text">No session records available.</span>
                  )}
                </div>
              </div>
            </section>

            {/* --------------------------------------------------------
                SECTION 3: COGNITIVE CHALLENGE PERFORMANCE REPORT
            -------------------------------------------------------- */}
            <section className="report-card challenge-report-section" id="challenge-report">
              <div className="report-card-header">
                <div className="card-title-group">
                  <span className="section-step-num">3</span>
                  <div>
                    <h2 className="report-card-title">Cognitive Challenge Performance Report</h2>
                    <p className="report-card-desc">
                      Detailed accuracy, completion metrics, challenge type breakdowns, and difficulty levels.
                    </p>
                  </div>
                </div>
              </div>

              <div className="kpi-cards-grid">
                <div className="kpi-mini-card">
                  <span className="kpi-icon">🧩</span>
                  <span className="kpi-label">Total Challenges</span>
                  <strong className="kpi-val">{challenge?.total_challenges || 0}</strong>
                </div>
                <div className="kpi-mini-card">
                  <span className="kpi-icon">🏁</span>
                  <span className="kpi-label">Completion Rate</span>
                  <strong className="kpi-val">{challenge?.completion_percentage?.toFixed(1) || "0.0"}%</strong>
                </div>
                <div className="kpi-mini-card">
                  <span className="kpi-icon">🎯</span>
                  <span className="kpi-label">Accuracy Rate</span>
                  <strong className="kpi-val">{challenge?.accuracy_percentage?.toFixed(1) || "0.0"}%</strong>
                </div>
                <div className="kpi-mini-card">
                  <span className="kpi-icon">⏱️</span>
                  <span className="kpi-label">Avg Response Time</span>
                  <strong className="kpi-val">{challenge?.average_response_time?.toFixed(1) || "0.0"} s</strong>
                </div>
              </div>

              {/* Challenge Types Table */}
              <div className="table-wrapper-box">
                <h3 className="sub-section-title">Performance by Challenge Type</h3>
                {challenge?.challenge_types && challenge.challenge_types.length > 0 ? (
                  <table className="report-data-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Total</th>
                        <th>Correct</th>
                        <th>Incorrect</th>
                        <th>Accuracy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {challenge.challenge_types.map((item) => (
                        <tr key={item.challenge_type}>
                          <td className="cell-type">
                            <span className="type-badge">{item.challenge_type}</span>
                          </td>
                          <td>{item.total}</td>
                          <td className="cell-correct">{item.correct}</td>
                          <td className="cell-incorrect">{item.incorrect}</td>
                          <td>
                            <div className="accuracy-cell-track">
                              <span className="accuracy-label">{item.accuracy.toFixed(1)}%</span>
                              <div className="table-bar">
                                <div
                                  className="table-bar-fill"
                                  style={{ width: `${Math.min(item.accuracy, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="no-data-text">No challenge type records found.</p>
                )}
              </div>

              {/* Difficulty Levels Table */}
              <div className="table-wrapper-box">
                <h3 className="sub-section-title">Performance by Difficulty Level</h3>
                {challenge?.difficulty_levels && challenge.difficulty_levels.length > 0 ? (
                  <table className="report-data-table">
                    <thead>
                      <tr>
                        <th>Difficulty</th>
                        <th>Total</th>
                        <th>Correct</th>
                        <th>Incorrect</th>
                        <th>Accuracy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {challenge.difficulty_levels.map((item) => (
                        <tr key={item.difficulty}>
                          <td className="cell-type">
                            <span className={`diff-badge diff-${item.difficulty.toLowerCase()}`}>
                              {item.difficulty}
                            </span>
                          </td>
                          <td>{item.total}</td>
                          <td className="cell-correct">{item.correct}</td>
                          <td className="cell-incorrect">{item.incorrect}</td>
                          <td>
                            <div className="accuracy-cell-track">
                              <span className="accuracy-label">{item.accuracy.toFixed(1)}%</span>
                              <div className="table-bar">
                                <div
                                  className="table-bar-fill"
                                  style={{ width: `${Math.min(item.accuracy, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="no-data-text">No difficulty level records found.</p>
                )}
              </div>
            </section>

            {/* --------------------------------------------------------
                SECTION 4: SLEEP & ADHERENCE REPORT
            -------------------------------------------------------- */}
            <section className="report-card sleep-report-section" id="sleep-report">
              <div className="report-card-header">
                <div className="card-title-group">
                  <span className="section-step-num">4</span>
                  <div>
                    <h2 className="report-card-title">Sleep &amp; Adherence Report</h2>
                    <p className="report-card-desc">
                      Alignment with target wake-up times and sleep duration schedule goals.
                    </p>
                  </div>
                </div>
              </div>

              <div className="sleep-details-grid">
                <div className="sleep-detail-card">
                  <span className="sleep-icon">🌅</span>
                  <span className="sleep-label">Preferred Wake Time</span>
                  <strong className="sleep-val">{sleep?.preferred_wake_time || "Not available"}</strong>
                </div>

                <div className="sleep-detail-card">
                  <span className="sleep-icon">🌙</span>
                  <span className="sleep-label">Target Sleep Duration</span>
                  <strong className="sleep-val">{sleep?.sleep_duration || "Not available"}</strong>
                </div>

                <div className="sleep-detail-card">
                  <span className="sleep-icon">📊</span>
                  <span className="sleep-label">Schedule Adherence Score</span>
                  <strong className="sleep-val">{sleep?.sleep_schedule_adherence?.toFixed(1) || "0.0"}%</strong>
                </div>
              </div>

              <div className="sleep-alignment-box">
                <h3 className="sub-section-title">Schedule Alignment Status</h3>
                <p className="alignment-text">{sleep?.schedule_alignment || "Not available"}</p>
                {!sleep?.has_profile_data && (
                  <div className="profile-hint-notice">
                    <span>💡 Tip:</span> Configure your preferred wake time and sleep duration in your{" "}
                    <button type="button" className="link-button" onClick={() => navigate("/profile")}>
                      Profile settings
                    </button>{" "}
                    to unlock personalized sleep adherence metrics.
                  </div>
                )}
              </div>
            </section>

            {/* --------------------------------------------------------
                SECTION 5: PRODUCTIVITY REPORT (NON-FABRICATED)
            -------------------------------------------------------- */}
            <section className="report-card productivity-report-section" id="productivity-report">
              <div className="report-card-header">
                <div className="card-title-group">
                  <span className="section-step-num">5</span>
                  <div>
                    <h2 className="report-card-title">Productivity Report</h2>
                    <p className="report-card-desc">
                      Target habit productivity goals and configured focus objectives.
                    </p>
                  </div>
                </div>
                <div className={`card-badge ${productivity?.has_productivity_data ? "badge-success" : "badge-muted"}`}>
                  {productivity?.status || "Not available"}
                </div>
              </div>

              {productivity?.has_productivity_data ? (
                <div className="productivity-content-configured">
                  <div className="prod-goal-banner">
                    <span className="prod-icon">🎯</span>
                    <div>
                      <h4 className="prod-sub-title">Configured Productivity Goals</h4>
                      <p className="prod-goal-text">{productivity.productivity_goals}</p>
                    </div>
                  </div>
                  <p className="prod-note">
                    Your cognitive challenges and morning alarms are aligned to support these productive focus targets.
                  </p>
                </div>
              ) : (
                <div className="productivity-content-empty">
                  <div className="empty-info-box">
                    <span className="empty-info-icon">ℹ️</span>
                    <div>
                      <h4 className="empty-info-title">Productivity data is not available yet.</h4>
                      <p className="empty-info-desc">
                        Define your productivity goals in your Habit settings to generate productivity insights.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default Reports;
