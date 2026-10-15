import React from "react";
import { useNavigate } from "react-router-dom";

export default function SleepAdherenceCard({ analytics }) {
  const navigate = useNavigate();
  const sleep = analytics?.sleep_adherence;

  if (!sleep) return null;

  return (
    <section className="analytics-card sleep-adherence-container">
      <div className="section-heading-row">
        <div>
          <span className="section-eyebrow">CIRCADIAN ALIGNMENT</span>
          <h2 className="section-main-title">Sleep &amp; Schedule Adherence</h2>
          <p className="section-desc">
            Synchronization between scheduled wake-up alarms and personal sleep duration targets.
          </p>
        </div>
        <div className={`card-badge-pill ${sleep.is_configured ? "badge-pill-configured" : "badge-pill-unconfigured"}`}>
          {sleep.is_configured ? "Profile Configured" : "Setup Required"}
        </div>
      </div>

      <div className="sleep-grid-cards">
        <div className="sleep-stat-box">
          <span className="sleep-stat-icon">🌅</span>
          <span className="sleep-stat-label">Preferred Wake Time</span>
          <strong className="sleep-stat-val">{sleep.preferred_wake_time}</strong>
          <span className="sleep-stat-sub">Target Morning Waking</span>
        </div>

        <div className="sleep-stat-box">
          <span className="sleep-stat-icon">🌙</span>
          <span className="sleep-stat-label">Target Sleep Duration</span>
          <strong className="sleep-stat-val">{sleep.sleep_duration}</strong>
          <span className="sleep-stat-sub">Nightly Rest Target</span>
        </div>

        <div className="sleep-stat-box">
          <span className="sleep-stat-icon">📈</span>
          <span className="sleep-stat-label">Schedule Adherence Score</span>
          <strong className="sleep-stat-val" style={{ color: "#38bdf8" }}>
            {sleep.sleep_schedule_adherence.toFixed(1)}%
          </strong>
          <span className="sleep-stat-sub">Evaluated Alarm Consistency</span>
        </div>
      </div>

      <div className="sleep-alignment-note">
        <div className="alignment-label-row">
          <span>Alignment Status:</span>
          <strong>{sleep.schedule_alignment}</strong>
        </div>
        {!sleep.is_configured && (
          <div className="sleep-setup-tip">
            <span>💡 Setup Tip:</span> Setting your target wake time and sleep duration in your{" "}
            <button type="button" className="inline-link-btn" onClick={() => navigate("/profile")}>
              Profile Settings
            </button>{" "}
            enables customized circadian adherence scoring.
          </div>
        )}
      </div>
    </section>
  );
}
