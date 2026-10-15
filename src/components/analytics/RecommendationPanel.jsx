import { useEffect, useState } from "react";
import { getRecommendations } from "../../services/api";

function formatCategory(category) {
  if (!category) return "General";
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function RecommendationPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    getRecommendations()
      .then((result) => {
        if (isMounted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load recommendations:", err);
          setError(err.message || "Failed to load recommendations");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleRetry() {
    setLoading(true);
    setError("");
    try {
      const result = await getRecommendations();
      setData(result);
    } catch (err) {
      console.error("Failed to reload recommendations:", err);
      setError(err.message || "Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="analytics-section m3-section">
        <div className="section-heading">
          <span className="m3-tag">SMART INSIGHTS</span>
          <h2>Personalized Recommendations</h2>
        </div>
        <div className="m3-loading-card">
          <div className="m3-spinner">💡</div>
          <p>Generating adaptive recommendations...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="analytics-section m3-section">
        <div className="section-heading">
          <span className="m3-tag">SMART INSIGHTS</span>
          <h2>Personalized Recommendations</h2>
        </div>
        <div className="m3-error-card">
          <p className="m3-error-text">⚠️ {error}</p>
          <button className="m3-retry-btn" onClick={handleRetry}>
            Retry Recommendations
          </button>
        </div>
      </section>
    );
  }

  const recommendations = data?.recommendations || [];

  return (
    <section className="analytics-section m3-section">
      <div className="section-heading">
        <span className="m3-tag">SMART INSIGHTS</span>
        <h2>Personalized Recommendations</h2>
      </div>

      {recommendations.length === 0 ? (
        <div className="m3-empty-card">
          <span className="empty-icon">🌟</span>
          <h3>All Caught Up!</h3>
          <p>
            Your wake-up habits and challenge accuracy are performing optimally.
            Keep maintaining your schedule!
          </p>
        </div>
      ) : (
        <div className="recommendations-list">
          {recommendations.map((item, index) => {
            const priorityLower = String(item.priority || "medium").toLowerCase();
            const badgeClass =
              priorityLower === "high"
                ? "priority-high"
                : priorityLower === "low"
                ? "priority-low"
                : "priority-medium";

            return (
              <div
                className={`recommendation-card border-${priorityLower}`}
                key={`${item.category}-${index}`}
              >
                <div className="recommendation-header">
                  <div className="recommendation-meta" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span className={`priority-tag ${badgeClass}`}>
                      {priorityLower.toUpperCase()} PRIORITY
                    </span>
                    <span className="category-tag">
                      {formatCategory(item.category)}
                    </span>
                    {item.prediction_source && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          padding: "0.15rem 0.45rem",
                          borderRadius: "4px",
                          background: item.prediction_source === "ml_model" ? "rgba(14, 165, 233, 0.15)" : "rgba(148, 163, 184, 0.15)",
                          color: item.prediction_source === "ml_model" ? "#38bdf8" : "#94a3b8",
                          fontWeight: 600,
                        }}
                      >
                        {item.prediction_source === "ml_model" ? "🤖 ML Model" : "📋 Rule-Based Fallback"}
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="recommendation-title">{item.title}</h3>
                <p className="recommendation-message">{item.message}</p>

                {item.supporting_metric && Object.keys(item.supporting_metric).length > 0 && (
                  <div className="recommendation-metric-badge">
                    {Object.entries(item.supporting_metric).map(([key, val]) => (
                      <span key={key}>
                        {key.replace(/_/g, " ")}: <strong>{String(val)}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
