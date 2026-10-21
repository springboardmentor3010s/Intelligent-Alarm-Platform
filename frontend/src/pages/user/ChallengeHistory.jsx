import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import API_URL from '../../config/api';

function ChallengeHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/challenges/history/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Challenge History 📜" subtitle="Review your past cognitive wake-up verifications">
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading history...</div>
      ) : history.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>😴</div>
          <h3 style={{ marginBottom: 8 }}>No challenges completed yet</h3>
          <p style={{ color: "var(--text-muted)" }}>Wake up to your alarms to see your history here!</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead style={{ background: "var(--glass-bg)", borderBottom: "1px solid var(--border)" }}>
              <tr>
                <th style={{ padding: "16px 24px", color: "var(--text-secondary)", fontSize: "0.85rem", textTransform: "uppercase" }}>Date</th>
                <th style={{ padding: "16px 24px", color: "var(--text-secondary)", fontSize: "0.85rem", textTransform: "uppercase" }}>Type</th>
                <th style={{ padding: "16px 24px", color: "var(--text-secondary)", fontSize: "0.85rem", textTransform: "uppercase" }}>Difficulty</th>
                <th style={{ padding: "16px 24px", color: "var(--text-secondary)", fontSize: "0.85rem", textTransform: "uppercase" }}>Result</th>
                <th style={{ padding: "16px 24px", color: "var(--text-secondary)", fontSize: "0.85rem", textTransform: "uppercase" }}>Score</th>
                <th style={{ padding: "16px 24px", color: "var(--text-secondary)", fontSize: "0.85rem", textTransform: "uppercase" }}>Time</th>
                <th style={{ padding: "16px 24px", color: "var(--text-secondary)", fontSize: "0.85rem", textTransform: "uppercase" }}>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--glass-highlight)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "16px 24px", color: "var(--text-primary)" }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "16px 24px", color: "var(--text-secondary)" }}>{item.challenge_type}</td>
                  <td style={{ padding: "16px 24px" }}>
                    <span className={`tag ${
                      item.difficulty === 'Easy' ? 'tag-success' :
                      item.difficulty === 'Medium' ? 'tag-warning' :
                      'tag-danger'
                    }`}>
                      {item.difficulty}
                    </span>
                  </td>
                  <td style={{ padding: "16px 24px" }}>
                    {item.status === 'completed' ? (
                      <span style={{ color: "var(--success)", fontWeight: "600" }}>✓ Passed</span>
                    ) : (
                      <span style={{ color: "var(--danger)", fontWeight: "600" }}>✗ Failed</span>
                    )}
                  </td>
                  <td style={{ padding: "16px 24px", fontWeight: "bold" }}>{item.score}</td>
                  <td style={{ padding: "16px 24px", color: "var(--text-muted)" }}>
                    {item.solve_time > 0 ? `${item.solve_time}s` : '--'}
                  </td>
                  <td style={{ padding: "16px 24px", color: "var(--text-muted)" }}>{item.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}

export default ChallengeHistory;
