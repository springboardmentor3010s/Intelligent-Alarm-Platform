import { useEffect, useState } from "react";
import { getWakeUpPrediction, getAlarms } from "../../services/api";

export default function WakeUpPredictionCard() {
  const [prediction, setPrediction] = useState(null);
  const [alarms, setAlarms] = useState([]);
  const [selectedAlarmId, setSelectedAlarmId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Load available alarms for user selector
    getAlarms()
      .then((alarmList) => {
        if (isMounted && Array.isArray(alarmList)) {
          setAlarms(alarmList);
        }
      })
      .catch((err) => {
        console.warn("Could not load alarms for prediction selector:", err);
      });

    loadPrediction(null, isMounted);

    return () => {
      isMounted = false;
    };
  }, []);

  async function loadPrediction(alarmId = null, isMounted = true) {
    setLoading(true);
    setError("");
    try {
      const data = await getWakeUpPrediction(alarmId);
      if (isMounted) {
        setPrediction(data);
        if (data && data.alarm_id) {
          setSelectedAlarmId(String(data.alarm_id));
        }
        setLoading(false);
      }
    } catch (err) {
      if (isMounted) {
        console.error("Failed to load wake-up prediction:", err);
        setError(err.message || "Failed to load ML wake-up prediction");
        setLoading(false);
      }
    }
  }

  function handleAlarmChange(e) {
    const val = e.target.value;
    setSelectedAlarmId(val);
    loadPrediction(val ? parseInt(val, 10) : null);
  }

  function getRiskBadgeClass(riskLevel) {
    const r = (riskLevel || "").toLowerCase();
    if (r === "low") return "pred-badge-low";
    if (r === "moderate") return "pred-badge-mod";
    return "pred-badge-high";
  }

  function getSourceBadgeLabel(source) {
    const s = (source || "").toLowerCase();
    if (s.includes("synthetic")) return "Synthetic Benchmark Model";
    if (s.includes("validated") || s.includes("real")) return "Validated Real-Data Model";
    return "Rule-Based Fallback";
  }

  // Normalize probability values to percentage (0 - 100)
  const onTimePct = prediction?.on_time_probability != null
    ? (prediction.on_time_probability <= 1.0
        ? Math.round(prediction.on_time_probability * 100)
        : Math.round(prediction.on_time_probability))
    : 0;

  const riskPct = prediction?.risk_probability != null
    ? (prediction.risk_probability <= 1.0
        ? Math.round(prediction.risk_probability * 100)
        : Math.round(prediction.risk_probability))
    : (100 - onTimePct);

  const predSource = prediction?.prediction_source || prediction?.model_source || "synthetic_benchmark_model";

  return (
    <div className="card prediction-card" style={{ marginBottom: "1.5rem" }}>
      <div className="prediction-header">
        <div className="prediction-title-group">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="prediction-icon">🤖</span>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
              AI Wake-Up Forecast
            </h3>
          </div>
          <p className="prediction-subtitle" style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", opacity: 0.8 }}>
            Probabilistic wake-up and snooze risk assessment based on circadian schedule alignment.
          </p>
        </div>

        {/* Alarm Selector dropdown if alarms exist */}
        {alarms.length > 1 && (
          <div className="prediction-alarm-selector">
            <label htmlFor="pred-alarm-select" style={{ fontSize: "0.8rem", marginRight: "0.5rem", opacity: 0.85 }}>
              Target Alarm:
            </label>
            <select
              id="pred-alarm-select"
              value={selectedAlarmId}
              onChange={handleAlarmChange}
              className="prediction-select"
            >
              <option value="">Next Scheduled Alarm</option>
              {alarms.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.alarm_time ? a.alarm_time.slice(0, 5) : "--:--"})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && (
        <div className="prediction-loading" style={{ padding: "2rem", textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto 1rem auto" }}></div>
          <p style={{ opacity: 0.8, fontSize: "0.9rem" }}>Evaluating circadian timing and predictive signals...</p>
        </div>
      )}

      {error && !loading && (
        <div className="prediction-error" style={{ padding: "1.5rem", textAlign: "center", color: "#f87171" }}>
          <p>⚠️ {error}</p>
          <button
            className="btn btn-secondary"
            onClick={() => loadPrediction(selectedAlarmId ? parseInt(selectedAlarmId, 10) : null)}
            style={{ marginTop: "0.5rem" }}
          >
            Retry Forecast
          </button>
        </div>
      )}

      {prediction && !loading && !error && (
        <div className="prediction-content">
          {/* Synthetic Benchmark Transparency Banner */}
          {predSource.includes("synthetic") && (
            <div className="pred-notice-banner" style={{
              background: "rgba(14, 165, 233, 0.08)",
              border: "1px solid rgba(14, 165, 233, 0.25)",
              borderRadius: "8px",
              padding: "0.6rem 0.85rem",
              marginBottom: "1rem",
              fontSize: "0.8rem",
              lineHeight: 1.4,
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
            }}>
              <span style={{ fontSize: "1rem" }}>ℹ️</span>
              <div>
                <strong>Benchmark Model:</strong> This forecast is powered by an XGBoost model trained on a calibrated circadian benchmark dataset to reflect standard sleep-wake dynamics. It is not an individualized clinical prediction.
              </div>
            </div>
          )}

          {/* Top KPI Metric Row */}
          <div className="prediction-kpi-row">
            {/* Probability Gauge Box */}
            <div className="prediction-prob-box">
              <div className="prediction-gauge-container">
                <svg className="prediction-gauge-svg" viewBox="0 0 100 100">
                  <circle
                    className="prediction-gauge-bg"
                    cx="50"
                    cy="50"
                    r="40"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    className={`prediction-gauge-fill ${
                      onTimePct >= 75
                        ? "gauge-green"
                        : onTimePct >= 50
                        ? "gauge-amber"
                        : "gauge-red"
                    }`}
                    cx="50"
                    cy="50"
                    r="40"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * onTimePct) / 100}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="prediction-gauge-value">
                  <span className="pred-num">{onTimePct}%</span>
                  <span className="pred-label">ON-TIME</span>
                </div>
              </div>
            </div>

            {/* Assessment Details */}
            <div className="prediction-summary-box">
              <div className="prediction-badge-row">
                <span className={`pred-risk-badge ${getRiskBadgeClass(prediction.risk_level)}`}>
                  {riskPct}% RISK ({prediction.risk_level ? prediction.risk_level.toUpperCase() : "MODERATE"})
                </span>
                <span className="pred-source-badge" title={prediction.confidence_note || prediction.disclaimer}>
                  {getSourceBadgeLabel(predSource)}
                </span>
                <span className="pred-model-ver">v{prediction.model_version || "1.0.0"}</span>
              </div>

              <h4 className="pred-headline">
                {prediction.alarm_name ? `Alarm "${prediction.alarm_name}"` : "Upcoming Alarm"}
                {prediction.alarm_time && (
                  <span className="pred-time-tag">
                    {" "}
                    @ {prediction.alarm_time.slice(0, 5)}
                  </span>
                )}
              </h4>

              <div className="pred-probabilities-pill-row" style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.82rem", background: "rgba(16, 185, 129, 0.12)", color: "#10b981", padding: "0.2rem 0.5rem", borderRadius: "6px", fontWeight: 600 }}>
                  On-Time Probability: {onTimePct}%
                </span>
                <span style={{ fontSize: "0.82rem", background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", padding: "0.2rem 0.5rem", borderRadius: "6px", fontWeight: 600 }}>
                  Snooze/Delay Risk: {riskPct}%
                </span>
              </div>

              <div className="pred-recommendation">
                <span className="pred-recom-icon">💡</span>
                <p><strong>Recommended Action:</strong> {prediction.recommendation}</p>
              </div>
            </div>
          </div>

          {/* Key Risk Factors List */}
          {prediction.risk_factors && prediction.risk_factors.length > 0 && (
            <div className="pred-risk-factors-container" style={{ marginTop: "1rem", padding: "0.75rem", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", border: "1px solid var(--border-color, #e2e8f0)" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span>⚠️</span>
                <span>Important Risk Factors & Circadian Influences</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.82rem", lineHeight: 1.5, opacity: 0.9 }}>
                {prediction.risk_factors.map((factorText, fIdx) => (
                  <li key={fIdx}>{factorText}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Behavioral Risk Drivers / Positive Signals Cards */}
          {prediction.insights && prediction.insights.length > 0 && (
            <div className="prediction-insights-section">
              <h5 style={{ margin: "0.75rem 0 0.5rem 0", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 }}>
                Circadian & Behavioral Signals
              </h5>
              <div className="prediction-insights-grid">
                {prediction.insights.map((item, idx) => (
                  <div
                    key={idx}
                    className={`pred-insight-card pred-impact-${item.impact.toLowerCase()}`}
                  >
                    <div className="pred-insight-header">
                      <span className="pred-impact-indicator">
                        {item.impact === "Positive" ? "✓" : item.impact === "Negative" ? "!" : "•"}
                      </span>
                      <strong>{item.factor}</strong>
                    </div>
                    <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.82rem", opacity: 0.9 }}>
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model Transparency & Feature Inspection Accordion */}
          <div className="prediction-transparency-box">
            <button
              type="button"
              className="prediction-toggle-btn"
              onClick={() => setShowDetails(!showDetails)}
            >
              <span>{showDetails ? "▼ Hide Diagnostics & Extracted Features" : "▶ Inspect Predictive Features & Model Signals"}</span>
              <span className="pred-algo-pill">{prediction.model_algorithm || "XGBoost Classifier"}</span>
            </button>

            {showDetails && (
              <div className="prediction-details-content">
                <p className="pred-disclaimer-note">
                  <em>{prediction.confidence_note || prediction.disclaimer}</em>
                </p>
                {prediction.extracted_features && Object.keys(prediction.extracted_features).length > 0 && (
                  <div className="pred-features-table-wrapper">
                    <table className="pred-features-table">
                      <thead>
                        <tr>
                          <th>Feature</th>
                          <th>Evaluation Value</th>
                          <th>Circadian Context</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Scheduled Alarm Hour</td>
                          <td><code>{prediction.extracted_features.alarm_hour}:00</code></td>
                          <td>Time of morning awakening signal</td>
                        </tr>
                        <tr>
                          <td>Weekend Schedule</td>
                          <td><code>{prediction.extracted_features.is_weekend ? "Yes (Weekend)" : "No (Weekday)"}</code></td>
                          <td>Higher snooze propensity observed on weekends</td>
                        </tr>
                        <tr>
                          <td>Cognitive Challenge</td>
                          <td><code>{String(prediction.extracted_features.challenge_type || "math").toUpperCase()} (Lvl {prediction.extracted_features.difficulty_num})</code></td>
                          <td>Working memory load at wake-up trigger</td>
                        </tr>
                        <tr>
                          <td>Schedule Difference</td>
                          <td><code>{prediction.extracted_features.schedule_diff_minutes} min</code></td>
                          <td>Variance between alarm and preferred wake target</td>
                        </tr>
                        <tr>
                          <td>Prior Snooze Rate</td>
                          <td><code>{typeof prediction.extracted_features.prior_snooze_rate === "number" ? `${Math.round(prediction.extracted_features.prior_snooze_rate * 100)}%` : "--"}</code></td>
                          <td>Historical delay frequency in previous completed alarms</td>
                        </tr>
                        <tr>
                          <td>Prior Habit Score</td>
                          <td><code>{prediction.extracted_features.prior_habit_score || "--"} / 100</code></td>
                          <td>Baseline consistency index</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", opacity: 0.7, textAlign: "right" }}>
                  Evaluated at: {new Date(prediction.evaluated_at).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
