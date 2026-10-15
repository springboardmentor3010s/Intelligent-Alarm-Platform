import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getAnalytics, isDemoActive } from "../services/api";

import ExecutiveKPICards from "../components/analytics/ExecutiveKPICards";
import ExecutiveSummaryCard from "../components/analytics/ExecutiveSummaryCard";
import WakeUpPerformanceChart from "../components/analytics/WakeUpPerformanceChart";
import CognitivePerformanceCharts from "../components/analytics/CognitivePerformanceCharts";
import SnoozeAnalyticsCard from "../components/analytics/SnoozeAnalyticsCard";
import HabitScoreVisualizer from "../components/analytics/HabitScoreVisualizer";
import SleepAdherenceCard from "../components/analytics/SleepAdherenceCard";

// Milestone 3 Intelligence Sections (Preserved)
import HabitScoreCard from "../components/analytics/HabitScoreCard";
import RecommendationPanel from "../components/analytics/RecommendationPanel";
import AdaptiveDifficultyCard from "../components/analytics/AdaptiveDifficultyCard";
import WakeUpPredictionCard from "../components/analytics/WakeUpPredictionCard";

function Analytics() {
  const navigate = useNavigate();
  const isDemo = isDemoActive();

  const [timeRange, setTimeRange] = useState("all");
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAnalytics(range = timeRange) {
    try {
      setLoading(true);
      setError("");
      const data = await getAnalytics(range);
      setAnalytics(data);
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics(timeRange);
  }, [timeRange]);

  function handleTimeRangeChange(newRange) {
    setTimeRange(newRange);
  }

  return (
    <div className="analytics-page-wrapper">
      <Navbar />

      <main className="analytics-container">
        {/* Demo Mode Notice Banner */}
        {isDemo && (
          <div className="reports-demo-banner" role="alert">
            <span className="demo-banner-icon">🎯</span>
            <div className="demo-banner-text">
              <strong>DEMO MODE &mdash; SAMPLE ANALYTICS (READ-ONLY)</strong>
              <span>
                You are viewing simulated executive analytics. No database records are queried or modified.
              </span>
            </div>
          </div>
        )}

        {/* Page Header */}
        <header className="analytics-header-card">
          <div className="analytics-header-left">
            <span className="reports-pill-tag">EXECUTIVE ANALYTICS</span>
            <h1 className="reports-main-title">Analytics Dashboard</h1>
            <p className="reports-subtitle">
              Comprehensive behavioral insights, cognitive challenge tracking, and performance metrics.
            </p>

            {/* Time Range Filter Pills */}
            <div className="time-range-filters-bar">
              <span className="filter-label">Time Window:</span>
              <div className="filter-pills-group">
                {[
                  { id: "7d", label: "Last 7 Days" },
                  { id: "30d", label: "Last 30 Days" },
                  { id: "90d", label: "Last 90 Days" },
                  { id: "all", label: "All Time" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`time-filter-pill ${timeRange === item.id ? "active" : ""}`}
                    onClick={() => handleTimeRangeChange(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="analytics-header-actions">
            <button
              type="button"
              className="reports-nav-btn"
              onClick={() => navigate("/reports")}
              title="View full reports and export PDF, Excel, and CSV"
            >
              📊 View Reports &amp; Export →
            </button>
            <button
              type="button"
              className="back-dashboard-btn"
              onClick={() => navigate("/dashboard")}
            >
              ← Back to Dashboard
            </button>
          </div>
        </header>

        {/* Loading State */}
        {loading && (
          <div className="analytics-loading-card">
            <div className="reports-spinner" />
            <p>Loading executive analytics dashboard...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="reports-error-card">
            <h2>Unable to load analytics</h2>
            <p>{error}</p>
            <button type="button" className="btn-retry" onClick={() => loadAnalytics(timeRange)}>
              Try Again
            </button>
          </div>
        )}

        {/* Analytics Content */}
        {!loading && !error && analytics && (
          <div className="executive-dashboard-flow">
            {/* 1. Executive KPI Section (Phase 2) */}
            <ExecutiveKPICards analytics={analytics} />

            {/* 2. Executive Performance Summary (Phase 8) */}
            <ExecutiveSummaryCard analytics={analytics} />

            {/* 3. Visual Charts Grid */}
            <div className="dashboard-charts-column">
              {/* Wake-Up Performance Chart (Phase 3) */}
              <WakeUpPerformanceChart analytics={analytics} />

              {/* Cognitive Performance Visualizations (Phase 4) */}
              <CognitivePerformanceCharts analytics={analytics} />

              {/* Snooze Analytics (Phase 5) */}
              <SnoozeAnalyticsCard analytics={analytics} />

              {/* Habit Score Visualization (Phase 6) */}
              <HabitScoreVisualizer analytics={analytics} />

              {/* Sleep & Adherence (Phase 7) */}
              <SleepAdherenceCard analytics={analytics} />
            </div>

            {/* 4. Detailed Milestone 3 Intelligence Sections (Phase 10 - PRESERVED) */}
            <div className="intelligence-engine-block">
              <div className="section-heading-row" style={{ marginTop: "24px", marginBottom: "16px" }}>
                <div>
                  <span className="section-eyebrow">INTELLIGENCE SUITE</span>
                  <h2 className="section-main-title">Detailed Behavioral &amp; Adaptive Engines</h2>
                  <p className="section-desc">
                    Comprehensive behavioral breakdowns, personalized coaching recommendations, and automated cognitive difficulty calibration.
                  </p>
                </div>
              </div>

              <HabitScoreCard />
              {/* <WakeUpPredictionCard /> */}
              <RecommendationPanel />
              <AdaptiveDifficultyCard />
            </div>

            {/* Footer refresh */}
            <footer className="analytics-footer-bar">
              <button
                type="button"
                onClick={() => loadAnalytics(timeRange)}
                className="refresh-btn"
              >
                ↻ Refresh Analytics
              </button>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}

export default Analytics;