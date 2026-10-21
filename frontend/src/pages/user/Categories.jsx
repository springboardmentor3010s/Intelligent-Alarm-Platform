import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";

import API_URL from "../../config/api";

const ALL_CATEGORIES = [
  { name: "Health & Fitness", icon: "💪", color: "#10b981" },
  { name: "Productivity", icon: "⚡", color: "#f59e0b" },
  { name: "Study & Education", icon: "📚", color: "#6366f1" },
  { name: "Sleep", icon: "😴", color: "#3b82f6" },
  { name: "Mental Wellness", icon: "🧘", color: "#a855f7" },
];

export default function Categories() {
  const token = localStorage.getItem("access_token");
  const [habits, setHabits] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/habits`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setHabits(await res.json());
      } catch (err) { console.error(err); }
    }
    if (token) load();
  }, [token]);

  function getCount(catName) {
    return habits.filter((h) => h.category === catName).length;
  }

  const selectedHabits = selected
    ? habits.filter((h) => h.category === selected)
    : [];

  return (
    <DashboardLayout title="Habit Categories 📂" subtitle="Browse and manage your habit categories">
      <div className="category-grid" style={{ marginBottom: 28 }}>
        {ALL_CATEGORIES.map((c) => {
          const count = getCount(c.name);
          return (
            <div
              key={c.name}
              className={`category-card ${selected === c.name ? "active" : ""}`}
              onClick={() => setSelected(selected === c.name ? null : c.name)}
            >
              <div className="category-card-icon">{c.icon}</div>
              <div className="category-card-name">{c.name}</div>
              <div className="category-card-count">{count} habit{count !== 1 ? "s" : ""}</div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="card">
          <div className="card-header">
            <h3>{ALL_CATEGORIES.find((c) => c.name === selected)?.icon} {selected} ({selectedHabits.length})</h3>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(null)}>✕ Clear</button>
          </div>
          {selectedHabits.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📂</div>
              <div className="empty-state-title">No habits in this category</div>
              <div className="empty-state-desc">Create a habit with this category to see it here.</div>
            </div>
          ) : (
            <div className="habit-list">
              {selectedHabits.map((h) => (
                <div key={h.id} className={`habit-card-item ${h.completed ? "completed" : ""}`}>
                  <div className={`habit-check ${h.completed ? "checked" : ""}`}>
                    {h.completed ? "✓" : ""}
                  </div>
                  <div className="habit-card-info">
                    <div className="habit-card-name">{h.name}</div>
                    <div className="habit-card-meta">
                      <span className="tag tag-outline">{h.frequency}</span>
                      <span className="tag tag-outline">⏱ {h.target_duration_minutes} min</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
