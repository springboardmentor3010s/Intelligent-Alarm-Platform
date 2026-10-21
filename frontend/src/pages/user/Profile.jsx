import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";

import API_URL from "../../config/api";

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
}

export default function Profile() {
  const token = localStorage.getItem("access_token");
  const user = getStoredUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [wakeupTime, setWakeupTime] = useState("06:30 AM");
  const [sleepDuration, setSleepDuration] = useState(7.5);
  const [timeZone, setTimeZone] = useState("UTC+05:30");
  const [difficulty, setDifficulty] = useState("Medium");
  const [goals, setGoals] = useState("");
  const [habitPrefs, setHabitPrefs] = useState("");
  const [sleepStart, setSleepStart] = useState("22:30");
  const [sleepEnd, setSleepEnd] = useState("06:30");
  const [message, setMessage] = useState("");
  const [msgType, setMsgType] = useState("success");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/profile`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to load profile");
        setName(data.Name || "");
        setEmail(data.Email || "");
        setWakeupTime(data.preferred_wakeup_time || "06:30 AM");
        setSleepDuration(data.sleep_duration || 7.5);
        setTimeZone(data.time_zone || "UTC+05:30");
        setDifficulty(data.difficulty_preference || "Medium");
        setGoals(data.productivity_goals || "");
        setHabitPrefs(data.habit_preferences || "");
        setSleepStart(data.sleep_schedule_start || "22:30");
        setSleepEnd(data.sleep_schedule_end || "06:30");
      } catch (err) { setMessage(err.message); setMsgType("error"); }
      finally { setLoading(false); }
    }
    if (token) load();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ Name: name, Email: email, Password: password || null, preferred_wakeup_time: wakeupTime, sleep_duration: parseFloat(sleepDuration), time_zone: timeZone, productivity_goals: goals, difficulty_preference: difficulty, habit_preferences: habitPrefs, sleep_schedule_start: sleepStart, sleep_schedule_end: sleepEnd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Update failed");
      setMessage("Profile updated successfully!");
      setMsgType("success");
      setPassword("");
      const stored = getStoredUser();
      stored.name = name;
      stored.email = email;
      localStorage.setItem("user", JSON.stringify(stored));
    } catch (err) { setMessage(err.message); setMsgType("error"); }
  }

  if (loading) return <DashboardLayout title="Profile"><div className="loading-spinner"><div className="spinner"></div></div></DashboardLayout>;

  const initials = (name || "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <DashboardLayout title="Profile 👤" subtitle="Manage your account and preferences">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar-lg">{initials}</div>
        <div className="profile-info">
          <h2>{name}</h2>
          <p>{email}</p>
          <span className={`role-badge role-${user.role}`} style={{ marginTop: 4, display: "inline-block" }}>
            {user.role === "admin" ? "Administrator" : user.role === "wellness_coach" ? "Wellness Coach" : "User"}
          </span>
        </div>
      </div>

      {message && <div className={`auth-alert ${msgType}`} style={{ marginBottom: 20 }}>{msgType === "success" ? "✅" : "⚠️"} {message}</div>}

      <form onSubmit={handleSubmit}>
        <div className="profile-form-grid">
          {/* Account Info */}
          <div className="card">
            <div className="card-header"><h3>Account & Credentials</h3></div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">New Password (optional)</label>
              <div className="password-wrapper">
                <input type={showPw ? "text" : "password"} placeholder="Leave blank to keep unchanged" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="password-toggle" onClick={() => setShowPw(!showPw)}>{showPw ? "🙈" : "👁️"}</button>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="card">
            <div className="card-header"><h3>Preferences & Cognitive Setup</h3></div>
            <div className="form-row">
              <div className="form-group half">
                <label className="form-label">Wake-up Time</label>
                <input value={wakeupTime} onChange={(e) => setWakeupTime(e.target.value)} placeholder="06:30 AM" />
              </div>
              <div className="form-group half">
                <label className="form-label">Sleep Duration (hrs)</label>
                <input type="number" step="0.5" value={sleepDuration} onChange={(e) => setSleepDuration(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group half">
                <label className="form-label">Time Zone</label>
                <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                  <option value="UTC+05:30">UTC+05:30 (IST)</option>
                  <option value="UTC+00:00">UTC+00:00 (GMT)</option>
                  <option value="UTC-05:00">UTC-05:00 (EST)</option>
                  <option value="UTC-08:00">UTC-08:00 (PST)</option>
                </select>
              </div>
              <div className="form-group half">
                <label className="form-label">Difficulty Preference</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option>Beginner</option><option>Easy</option><option>Medium</option><option>Hard</option><option>Expert</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sleep & Goals */}
          <div className="card full-span">
            <div className="card-header"><h3>Goals, Habits & Sleep Schedule</h3></div>
            <div className="form-row">
              <div className="form-group half">
                <label className="form-label">Bedtime</label>
                <input type="time" value={sleepStart} onChange={(e) => setSleepStart(e.target.value)} />
              </div>
              <div className="form-group half">
                <label className="form-label">Wake-up Time</label>
                <input type="time" value={sleepEnd} onChange={(e) => setSleepEnd(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Productivity Goals</label>
              <textarea rows={2} placeholder="e.g., Morning meditation, 30 min reading, exercise" value={goals} onChange={(e) => setGoals(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Habit Preferences</label>
              <textarea rows={2} placeholder="e.g., Prefer morning routines, gentle chimes" value={habitPrefs} onChange={(e) => setHabitPrefs(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary btn-lg">💾 Save Profile Changes</button>
          </div>
        </div>
      </form>
    </DashboardLayout>
  );
}
