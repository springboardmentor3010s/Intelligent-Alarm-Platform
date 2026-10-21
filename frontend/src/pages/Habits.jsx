import { useEffect, useState } from "react";

import {
  AreaChart,
  Area,
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

function Habits({ onContinue, onBack, onProfileUpdated }) {
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepDuration, setSleepDuration] = useState(8);
  const [goal, setGoal] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [habitPreferences, setHabitPreferences] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadHabits() {
      try {
        const data = await getProfile();
        setWakeTime(data.preferred_wake_time || "07:00");
        setSleepDuration(data.sleep_duration || 8);
        setGoal(data.productivity_goal || "");
        setDifficulty(data.difficulty_preference || "medium");
        setHabitPreferences(data.habit_preferences || "");
      } catch (err) {
        setError(err.response?.data?.detail || "Unable to load habits.");
      } finally {
        setLoading(false);
      }
    }
    loadHabits();
  }, []);

  async function handleSave(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const updatedUser = await updateProfile({
        preferred_wake_time: wakeTime,
        sleep_duration: Number(sleepDuration),
        productivity_goal: goal,
        difficulty_preference: difficulty,
        habit_preferences: habitPreferences,
      });
      if (onProfileUpdated) onProfileUpdated(updatedUser);
      setMessage("Habits and routine preferences saved successfully!");
      setTimeout(() => onContinue(), 700);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to save habits.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageShell eyebrow="Daily Routines" title="Habit & Sleep Architecture" onBack={onBack} backLabel="← Profile">
        <Card>
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🌱</div>
            <h3 style={{ color: "#fff", margin: 0 }}>Loading your habit routines...</h3>
          </div>
        </Card>
      </PageShell>
    );
  }

  const habitList = habitPreferences
    ? habitPreferences.split(/[,\n]/).map((h) => h.trim()).filter(Boolean)
    : [];

  const sleepPct = Math.round((Number(sleepDuration) / 12) * 100);
  const difficultyPct = DIFFICULTY_SCORE[difficulty] || 70;

  const consistencyData = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => ({
    day,
    consistency: Math.round(Math.min(100, difficultyPct * (0.55 + i * 0.075))),
  }));

  return (
    <PageShell
      eyebrow="Daily Routines"
      title="Habit & Sleep Architecture"
      subtitle="Calibrate your optimal sleep cycle and define habits to reinforce post-wake focus."
      onBack={onBack}
      backLabel="← Profile"
    >
      {/* STAT CARDS */}
      <div style={statGrid}>
        <StatCard icon="🌙" label="Planned Sleep" value={`${sleepDuration}h`} accent={COLORS.primary} />
        <StatCard icon="⏰" label="Target Wake" value={wakeTime} accent={COLORS.cyan} />
        <StatCard icon="🎯" label="Difficulty Target" value={difficulty} accent={COLORS.amber} />
        <StatCard icon="🔥" label="Active Habit Routines" value={habitList.length} accent={COLORS.emerald} />
      </div>

      {error && <div className="alert-box alert-error">⚠️ {error}</div>}
      {message && <div className="alert-box alert-success">✅ {message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
        {/* HABIT FORM */}
        <Card title="Habit Customization" subtitle="Adjust wake times and morning focus goals">
          <form onSubmit={handleSave}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Wake-Up Time</label>
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
              <label className="form-label">Daily Morning Focus Goal</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g., Read technical book for 30 minutes"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Challenge Difficulty</label>
              <select
                className="form-select"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="beginner">Beginner (Gentle wake)</option>
                <option value="easy">Easy (Mild wake stimulation)</option>
                <option value="medium">Medium (Recommended)</option>
                <option value="hard">Hard (Maximum alertness test)</option>
                <option value="expert">Expert (Maximum challenge)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Habit Preferences & Keywords</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g., Cold shower, Hydration, Breathwork, Journaling"
                value={habitPreferences}
                onChange={(e) => setHabitPreferences(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: "100%", marginTop: 10 }}
              disabled={saving}
            >
              {saving ? "Saving Habits..." : "Save Habits & Return to Dashboard →"}
            </button>
          </form>
        </Card>

        {/* PROJECTED INSIGHTS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="Projected Weekly Consistency" subtitle="Estimated habit stability over 7 days" badge="7 DAYS">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={consistencyData} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="habitArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="consistency"
                  stroke={COLORS.primary}
                  fill="url(#habitArea)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Card title="Sleep Window" subtitle="of 12h max">
              <Gauge value={sleepPct} label="sleep" color={COLORS.primary} suffix="h" height={150} />
            </Card>
            <Card title="Difficulty Level" subtitle="Scale 0-100">
              <Gauge value={difficultyPct} label="difficulty" color={COLORS.amber} height={150} />
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export default Habits;
