import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";

import API_URL from "../../config/api";

const CATEGORIES = [
  { name: "Health & Fitness", icon: "💪" },
  { name: "Productivity", icon: "⚡" },
  { name: "Study & Education", icon: "📚" },
  { name: "Sleep", icon: "😴" },
  { name: "Mental Wellness", icon: "🧘" },
];

const FREQUENCIES = ["Daily", "Weekly", "Weekdays", "Weekends", "Custom Days", "Multiple Times Per Day", "Every X Days", "Monthly"];
const PRIORITIES = ["High", "Medium", "Low"];
const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function AddHabit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = localStorage.getItem("access_token");
  const editId = searchParams.get("edit");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Health & Fitness");
  const [customCategory, setCustomCategory] = useState("");
  const [frequency, setFrequency] = useState("Daily");
  const [selectedDays, setSelectedDays] = useState([...ALL_DAYS]);
  const [duration, setDuration] = useState(15);
  const [priority, setPriority] = useState("Medium");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [msgType, setMsgType] = useState("error");

  useEffect(() => {
    async function loadHabitForEdit() {
      if (!editId) return;
      try {
        const res = await fetch(`${API_URL}/habits`, { headers: { Authorization: `Bearer ${token}` } });
        const habit = res.ok && (await res.json()).find((item) => String(item.id) === editId);
        if (!habit) throw new Error("Habit not found");
        setName(habit.name || "");
        setDescription(habit.description || "");
        setCategory(habit.category || "Health & Fitness");
        setFrequency(habit.frequency || "Daily");
        setDuration(habit.target_duration_minutes || 15);
        setPriority(habit.priority || "Medium");
        setReminderTime(habit.reminder_time || "");
        setStartDate(habit.start_date || "");
        setTargetDate(habit.target_date || "");
        setGoalTarget(habit.goal_target || "");
        setEnabled(habit.is_enabled !== false);
      } catch (err) {
        setMessage(err.message || "Unable to load habit");
        setMsgType("error");
      }
    }
    loadHabitForEdit();
  }, [editId, token]);

  function toggleDay(day) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setMessage("Habit name is required.");
      setMsgType("error");
      return;
    }

    const finalCategory = category === "Custom" && customCategory.trim()
      ? customCategory.trim()
      : category;

    try {
      const res = await fetch(editId ? `${API_URL}/habits/${editId}` : `${API_URL}/habits`, {
        method: editId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          category: finalCategory,
          frequency,
          target_duration_minutes: parseInt(duration) || 15,
          priority,
          reminder_time: reminderTime || null,
          start_date: startDate || null,
          target_date: targetDate || null,
          goal_target: goalTarget.trim(),
          is_enabled: enabled,
        }),
      });

      if (res.ok) {
        setMessage(editId ? "Habit updated successfully!" : "Habit created successfully!");
        setMsgType("success");
        setTimeout(() => navigate("/habits"), 1000);
      } else {
        let errorMsg = "Failed to create habit";
        try {
          const data = await res.json();
          errorMsg = Array.isArray(data.detail) ? data.detail[0].msg : (data.detail || errorMsg);
        } catch (e) {}
        throw new Error(errorMsg);
      }
    } catch (err) {
      setMessage(err.message === "Failed to fetch" ? "Network error: Make sure backend is running." : err.message);
      setMsgType("error");
    }
  }

  return (
    <DashboardLayout title="Add New Habit ➕" subtitle="Create a new habit to track">
      {message && (
        <div className={`auth-alert ${msgType}`} style={{ marginBottom: 20 }}>
          {msgType === "error" ? "⚠️" : "✅"} {message}
        </div>
      )}

      <div className="card-grid-2">
        {/* Main Form */}
        <div className="card">
          <div className="card-header">
            <h3>Habit Details</h3>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Habit Name *</label>
              <input type="text" placeholder="e.g., Morning Meditation" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea placeholder="Describe your habit..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            {category === "Custom" && (
              <div className="form-group">
                <label className="form-label">Custom Category Name</label>
                <input type="text" placeholder="Enter custom category" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} />
              </div>
            )}

            <div className="form-row">
              <div className="form-group half">
                <label className="form-label">Frequency</label>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="form-group half">
                <label className="form-label">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {(frequency === "Custom Days" || frequency === "Weekly") && (
              <div className="form-group">
                <label className="form-label">Select Days</label>
                <div className="day-picker">
                  {ALL_DAYS.map((d) => (
                    <button key={d} type="button" className={`day-pill ${selectedDays.includes(d) ? "selected" : ""}`} onClick={() => toggleDay(d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group half">
                <label className="form-label">Duration</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select 
                    value={Math.floor((parseInt(duration) || 0) / 60)} 
                    onChange={(e) => setDuration(parseInt(e.target.value) * 60 + ((parseInt(duration) || 0) % 60))}
                    style={{ flex: 1 }}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i} hr</option>
                    ))}
                  </select>
                  <select 
                    value={(parseInt(duration) || 0) % 60} 
                    onChange={(e) => setDuration(Math.floor((parseInt(duration) || 0) / 60) * 60 + parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={i} value={i}>{i} min</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group half">
                <label className="form-label">Reminder Time</label>
                <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label className="form-label">Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="form-group half">
                <label className="form-label">Target Date</label>
                <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Goal / Target</label>
              <input type="text" placeholder="e.g., Meditate 30 days straight" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} />
            </div>

            <div className="settings-row" style={{ borderBottom: "none", marginBottom: 16 }}>
              <div className="settings-label">
                <span>Enable Habit</span>
                <span>Track this habit starting now</span>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                ✓ Create Habit
              </button>
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => navigate("/habits")}>
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Category Preview */}
        <div className="card">
          <div className="card-header">
            <h3>📂 Categories</h3>
          </div>
          <div className="category-grid">
            {CATEGORIES.map((c) => (
              <div
                key={c.name}
                className={`category-card ${category === c.name ? "active" : ""}`}
                onClick={() => setCategory(c.name)}
              >
                <div className="category-card-icon">{c.icon}</div>
                <div className="category-card-name">{c.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
