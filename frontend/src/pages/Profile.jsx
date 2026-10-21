import { useEffect, useState } from "react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { getProfile, updateProfile } from "../services/api";

import {
  PageShell,
  Card,
  StatCard,
} from "../components/ChartKit";
import Gauge from "../components/Gauge";
import { COLORS, tooltipStyle, gridStroke, axisTick, statGrid } from "../components/chartTokens";

const DIFFICULTY_SCORE = { beginner: 20, easy: 40, medium: 60, hard: 80, expert: 100 };
const TIME_ZONES = typeof Intl.supportedValuesOf === "function"
  ? ["UTC", ...Intl.supportedValuesOf("timeZone").filter((zone) => zone !== "UTC")]
  : ["UTC", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York"];

function Profile({ user, onProfileUpdated, onBack }) {
  const [name, setName] = useState(user?.name || "");
  const [wakeTime, setWakeTime] = useState(user?.preferred_wake_time || "07:00");
  const [sleepDuration, setSleepDuration] = useState(user?.sleep_duration ?? 8);
  const [timezone, setTimezone] = useState(user?.timezone || "Asia/Kolkata");
  const [productivityGoal, setProductivityGoal] = useState(user?.productivity_goal || "");
  const [difficulty, setDifficulty] = useState(user?.difficulty_preference || "medium");
  const [habits, setHabits] = useState(user?.habit_preferences || "");
  const [rolePreference, setRolePreference] = useState(user?.role_preference || "");

  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoadingProfile(true);
        setError("");
        const data = await getProfile();

        setName(data.name || "");
        setWakeTime(data.preferred_wake_time || "07:00");
        setSleepDuration(data.sleep_duration ?? 8);
        setTimezone(data.timezone || "Asia/Kolkata");
        setProductivityGoal(data.productivity_goal || "");
        setDifficulty(data.difficulty_preference || "medium");
        setHabits(data.habit_preferences || "");
        setRolePreference(data.role_preference || "");

        if (onProfileUpdated) onProfileUpdated(data);
      } catch (err) {
        setError(err.response?.data?.detail || "Unable to load profile.");
      } finally {
        setLoadingProfile(false);
      }
    }
    loadProfile();
  }, [onProfileUpdated]);

  async function handleSaveProfile(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!rolePreference) {
      setError("Please select your role preference before continuing.");
      return;
    }

    setLoading(true);
    const profileData = {
      name,
      preferred_wake_time: wakeTime,
      sleep_duration: Number(sleepDuration),
      timezone,
      productivity_goal: productivityGoal,
      difficulty_preference: difficulty,
      habit_preferences: habits,
      role_preference: rolePreference,
    };

    try {
      const updatedUser = await updateProfile(profileData);
      if (onProfileUpdated) onProfileUpdated(updatedUser);
      setMessage("Profile and preferences saved successfully!");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail ? (typeof detail === "string" ? detail : JSON.stringify(detail)) : "Unable to update profile.");
    } finally {
      setLoading(false);
    }
  }

  if (loadingProfile) {
    return (
      <PageShell eyebrow="User Settings" title="Profile & Preferences" onBack={onBack} backLabel="← Dashboard">
        <Card>
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
            <h3 style={{ color: "#fff", margin: 0 }}>Loading your profile data...</h3>
          </div>
        </Card>
      </PageShell>
    );
  }

  /* Derived Visualization Metrics */
  const sleepPct = Math.round((Number(sleepDuration) / 12) * 100);
  const difficultyPct = DIFFICULTY_SCORE[difficulty] || 70;

  const habitCount = habits
    ? habits.split(/[,\n]/).map((h) => h.trim()).filter(Boolean).length
    : 0;

  const readinessData = [
    { name: "Sleep Target", value: sleepPct },
    { name: "Difficulty", value: difficultyPct },
    { name: "Active Habits", value: Math.min(habitCount * 25, 100) },
    { name: "Target Goal", value: productivityGoal ? 100 : 30 },
    { name: "Role Defined", value: rolePreference ? 100 : 0 },
  ];

  const profileCompletion = Math.round(
    ([name, rolePreference, wakeTime, sleepDuration, productivityGoal, habits].filter(Boolean).length / 6) * 100
  );

  return (
    <PageShell
      eyebrow="User Settings"
      title="Profile & Lifestyle Configuration"
      subtitle="Personalize your identity, routine schedules, and challenge preferences."
      onBack={onBack}
      backLabel="← Dashboard"
    >
      {/* STAT CARDS */}
      <div style={statGrid}>
        <StatCard icon="🌙" label="Sleep Target" value={`${sleepDuration}h`} accent={COLORS.primary} />
        <StatCard icon="⏰" label="Target Wake Time" value={wakeTime} accent={COLORS.cyan} />
        <StatCard icon="🎯" label="Difficulty Level" value={difficulty} accent={COLORS.amber} />
        <StatCard icon="✅" label="Profile Completeness" value={`${profileCompletion}%`} accent={COLORS.emerald} />
      </div>

      {error && <div className="alert-box alert-error">⚠️ {error}</div>}
      {message && <div className="alert-box alert-success">✅ {message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
        {/* EDIT PROFILE FORM */}
        <Card title="Account & Preferences" subtitle="Update your personal alarm settings">
          <form onSubmit={handleSaveProfile}>
            <div className="form-group">
              <label className="form-label">
                Full Name <span className="required">*</span>
              </label>
              <input
                className="form-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                className="form-input"
                style={{ opacity: 0.65 }}
                type="email"
                value={user?.email || ""}
                disabled
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Role Preference <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={rolePreference}
                onChange={(e) => setRolePreference(e.target.value)}
                required
              >
                <option value="">-- Select your primary role --</option>
                <option value="student">Student</option>
                <option value="working_professional">Working Professional</option>
                <option value="developer">Developer / Engineer</option>
                <option value="manager">Manager / Team Lead</option>
                <option value="homemaker">Homemaker</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Preferred Wake Time</label>
                <input
                  className="form-input"
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Sleep Duration (hrs)</label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={sleepDuration}
                  onChange={(e) => setSleepDuration(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Timezone</label>
              <select
                className="form-select"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIME_ZONES.map((zone) => (
                  <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Productivity Goal</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g., Code for 2 hours before 9 AM"
                value={productivityGoal}
                onChange={(e) => setProductivityGoal(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Difficulty Preference</label>
              <select
                className="form-select"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="beginner">Beginner (Gentle wake)</option>
                <option value="easy">Easy (Gentle wake)</option>
                <option value="medium">Medium (Balanced focus)</option>
                <option value="hard">Hard (High intensity)</option>
                <option value="expert">Expert (Maximum challenge)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Habit Preferences</label>
              <textarea
                className="form-textarea"
                rows="3"
                placeholder="e.g., Drink 500ml water, stretch for 10m, review morning tasks..."
                value={habits}
                onChange={(e) => setHabits(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: "100%", marginTop: 8 }}
              disabled={loading}
            >
              {loading ? "Saving Profile..." : "Save Profile & Preferences"}
            </button>
          </form>
        </Card>

        {/* INSIGHTS & READINESS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="Target Sleep Window" subtitle="Fraction of a recommended 12h reference window">
            <Gauge value={sleepPct} label="sleep" color={COLORS.primary} suffix="h" />
            <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
              Planned: <strong>{sleepDuration} hours</strong> per night
            </p>
          </Card>

          <Card title="Routine Setup Completeness" subtitle="Configuration of your morning setup">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={readinessData} layout="vertical" margin={{ left: 16, right: 16, top: 10, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={gridStroke} strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={axisTick} tickLine={false} axisLine={false} width={90} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={COLORS.primary} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

export default Profile;
