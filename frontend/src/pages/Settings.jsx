import { useEffect, useState } from "react";
import "../App.css";
import { apiFetch } from "../api";
import { useAuth } from "../auth";
import {
  CHALLENGE_LABELS,
  DIFFICULTIES,
  ErrorBox,
  Loading,
  titleCase,
} from "../components/ui";

function Settings() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [goal, setGoal] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ current_password: "", new_password: "" });

  useEffect(() => {
    apiFetch(`/profile/${user.id}`)
      .then(setProfile)
      .catch((err) => setError(err.message));
    if (user.role === "user") {
      apiFetch(`/profile/${user.id}/habit-profile`)
        .then((data) => setGoal(data.wake_up_goal))
        .catch(() => {});
    }
  }, [user.id]);

  if (!profile) {
    return <div className="page-container">{error ? <ErrorBox message={error} /> : <Loading />}</div>;
  }

  const set = (key) => (event) => setProfile({ ...profile, [key]: event.target.value });
  const isMember = user.role === "user";

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const list = (text) =>
      (Array.isArray(text) ? text : String(text || "").split(","))
        .map((item) => item.trim())
        .filter(Boolean);
    try {
      const body = {
        full_name: profile.full_name,
        timezone: profile.timezone,
      };
      if (isMember) {
        Object.assign(body, {
          wake_time: profile.wake_time || null,
          sleep_time: profile.sleep_time || null,
          sleep_duration_hours: Number(profile.sleep_duration_hours),
          difficulty_preference: profile.difficulty_preference,
          preferred_challenge: profile.preferred_challenge,
          productivity_goals: list(profile.productivity_goals),
          habit_preferences: list(profile.habit_preferences),
          wake_up_goal: profile.wake_up_goal || "",
          wake_goal_days_per_week: Number(profile.wake_goal_days_per_week),
        });
      }
      const updated = await apiFetch(`/profile/${user.id}`, { method: "PUT", body });
      setProfile(updated);
      await refreshUser();
      setNotice("Settings saved.");
      if (isMember) {
        apiFetch(`/profile/${user.id}/habit-profile`).then((d) => setGoal(d.wake_up_goal)).catch(() => {});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await apiFetch("/auth/change-password", { method: "POST", body: pw });
      setPw({ current_password: "", new_password: "" });
      setNotice("Password changed.");
    } catch (err) {
      setError(err.message);
    }
  };

  const listText = (value) => (Array.isArray(value) ? value.join(", ") : value || "");

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h1>Settings</h1>
          <p className="subtitle">Your profile, sleep schedule, goals and habit preferences.</p>
        </div>
      </div>

      <ErrorBox message={error} />
      {notice && <div className="notice-box">{notice}</div>}

      <form className="alarms-card settings-form" onSubmit={save}>
        <div className="card-header"><div><h2>Profile</h2></div></div>

        <label>Full name
          <input value={profile.full_name} onChange={set("full_name")} required maxLength={120} />
        </label>
        <label>Email
          <input value={profile.email} disabled />
        </label>
        <label>Time zone
          <input value={profile.timezone} onChange={set("timezone")} placeholder="Asia/Kolkata" />
        </label>

        {isMember && (
          <>
            <div className="card-header" style={{ marginTop: 22 }}><div><h2>Sleep and wake-up</h2></div></div>
            <label>Preferred wake-up time
              <input type="time" value={profile.wake_time || ""} onChange={set("wake_time")} />
            </label>
            <label>Target bedtime
              <input type="time" value={profile.sleep_time || ""} onChange={set("sleep_time")} />
            </label>
            <label>Sleep duration goal (hours)
              <input type="number" min={3} max={14} step={0.25} value={profile.sleep_duration_hours}
                onChange={set("sleep_duration_hours")} />
            </label>

            <div className="card-header" style={{ marginTop: 22 }}><div><h2>Challenges</h2></div></div>
            <label>Difficulty preference
              <select value={profile.difficulty_preference} onChange={set("difficulty_preference")}>
                {DIFFICULTIES.map((level) => <option key={level} value={level}>{titleCase(level)}</option>)}
              </select>
            </label>
            <label>Favorite challenge type
              <select value={profile.preferred_challenge} onChange={set("preferred_challenge")}>
                {Object.entries(CHALLENGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <div className="card-header" style={{ marginTop: 22 }}><div><h2>Goals and habits</h2></div></div>
            <label>Wake-up goal
              <input value={profile.wake_up_goal || ""} onChange={set("wake_up_goal")} maxLength={255}
                placeholder="For example: wake up at 6:30 without snoozing" />
            </label>
            <label>Goal: days per week
              <input type="number" min={1} max={7} value={profile.wake_goal_days_per_week}
                onChange={set("wake_goal_days_per_week")} />
            </label>
            {goal && (
              <p className="muted-line">
                Progress: {goal.days_achieved} of {goal.goal_days_per_week} days this week ({goal.percent}%)
                {goal.met ? " – goal met!" : ""}
              </p>
            )}
            <label>Productivity goals (separate with commas)
              <input value={listText(profile.productivity_goals)} onChange={set("productivity_goals")}
                placeholder="Study 2 hours, Morning workout" />
            </label>
            <label>Habit preferences (separate with commas)
              <input value={listText(profile.habit_preferences)} onChange={set("habit_preferences")}
                placeholder="No phone before breakfast, Evening walk" />
            </label>
          </>
        )}

        <button className="generate-button" type="submit" disabled={saving} style={{ marginTop: 22 }}>
          {saving ? "Saving..." : "Save settings"}
        </button>
      </form>

      <form className="alarms-card settings-form" onSubmit={changePassword}>
        <div className="card-header"><div><h2>Change password</h2></div></div>
        <label>Current password
          <input type="password" value={pw.current_password} required autoComplete="current-password"
            onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
        </label>
        <label>New password
          <input type="password" value={pw.new_password} required minLength={8} autoComplete="new-password"
            onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
          <small>At least 8 characters, with a letter and a number.</small>
        </label>
        <button className="generate-button" type="submit">Change password</button>
      </form>
    </div>
  );
}

export default Settings;
