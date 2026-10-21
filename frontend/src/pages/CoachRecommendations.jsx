import { useCallback, useEffect, useState } from "react";
import { Card, EmptyState, PageShell } from "../components/ChartKit.jsx";
import { getAdminRecommendations, getRecommendationHistory } from "../services/api";

const PRIORITY_LABELS = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
};

const CATEGORY_LABELS = {
  post_alarm_performance: "After-alarm performance",
  coach_guidance: "Wellness Coach guidance",
  cognitive_performance: "Cognitive performance",
  snooze_control: "Snooze control",
  consistency: "Consistency",
  difficulty: "Challenge difficulty",
  positive_reinforcement: "Progress",
  onboarding: "Getting started",
};

function CoachRecommendations({ onBack, isAdmin = false }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const records = isAdmin
        ? await getAdminRecommendations()
        : await getRecommendationHistory();
      setRecommendations(records);
      setError("");
    } catch {
      setError(isAdmin
        ? "Unable to load platform-wide recommendations. Please try again."
        : "Unable to load your Wellness Coach recommendations. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRecommendations();
    }, 0);
    window.addEventListener("cognitive-alarm:performance-updated", loadRecommendations);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("cognitive-alarm:performance-updated", loadRecommendations);
    };
  }, [loadRecommendations]);

  return (
    <PageShell
      eyebrow={isAdmin ? "Platform guidance" : "Personal guidance"}
      title={isAdmin ? "Platform Coach Recommendations" : "Wellness Coach Recommendations"}
      subtitle={isAdmin
        ? "Review the latest 100 recommendations from the past 30 days across user accounts. This feed is separate from reviewing user behavior and sending new guidance in Wellness Coach."
        : "All saved guidance for your account, including recommendations based on your completed alarm performance."}
      onBack={onBack}
      action={
        <button className="btn btn-secondary btn-sm" onClick={() => void loadRecommendations()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      }
    >
      {error && <div className="alert-box alert-error" role="alert">{error}</div>}
      {loading && <p className="role-status" role="status">{isAdmin ? "Loading platform recommendations…" : "Loading recommendations…"}</p>}
      {!loading && !error && recommendations.length === 0 && (
        <Card wide>
          <EmptyState
            icon="🩺"
            title="No recommendations yet"
            description={isAdmin
              ? "Recommendations and coach follow-ups for platform users will appear here when recorded."
              : "Complete an alarm to receive performance-based feedback. Guidance from your Wellness Coach will also appear here."}
          />
        </Card>
      )}
      {recommendations.map((item) => (
        <Card
          key={item.id}
          wide
          title={item.title}
          subtitle={`${isAdmin ? `For ${item.user_name || "Deleted user"} · ` : ""}${CATEGORY_LABELS[item.category] || "Wellness guidance"} · ${item.created_at ? new Date(item.created_at).toLocaleString() : "Date unavailable"}`}
          badge={PRIORITY_LABELS[item.priority] || "Recommendation"}
        >
          <p className="role-muted">{item.reason}</p>
          {item.supporting_metric && <p className="role-muted"><strong>Recorded performance:</strong> {item.supporting_metric}</p>}
          <p><strong>Suggested action:</strong> {item.suggested_action}</p>
          {(isAdmin || item.is_dismissed || item.is_acted_upon) && (
            <p className="role-muted">Status: {item.is_dismissed ? "Dismissed" : item.is_acted_upon ? "Acted upon" : "Pending"}</p>
          )}
        </Card>
      ))}
    </PageShell>
  );
}

export default CoachRecommendations;
