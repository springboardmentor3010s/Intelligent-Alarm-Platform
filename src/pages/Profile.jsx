import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getProfile, updateProfile, getHabits, updateHabits } from "../services/api";

function Profile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [habits, setHabits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [editMode, setEditMode] = useState(false);

  const [formData, setFormData] = useState({
    // Profile & Sleep schedule
    preferred_wake_time: "",
    sleep_duration: "",
    time_zone: "",
    difficulty_preference: "medium",
    // Habit goals & preferences
    wake_up_goal: "",
    productivity_goals: "",
    habit_preferences: "",
  });

  // =========================================
  // FORMAT TIME
  // 06:30:00 → 06:30 AM
  // =========================================

  function formatWakeTime(timeValue) {
    if (!timeValue) {
      return "Not set";
    }

    const [hours, minutes] = timeValue.split(":").map(Number);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return timeValue;
    }

    const period = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;

    return `${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
  }

  // =========================================
  // LOAD PROFILE & HABITS
  // =========================================

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [profileData, habitsData] = await Promise.all([
          getProfile(),
          getHabits(),
        ]);

        setProfile(profileData);
        setHabits(habitsData);

        setFormData({
          preferred_wake_time: profileData?.preferred_wake_time || "",
          sleep_duration: profileData?.sleep_duration ?? "",
          time_zone: profileData?.time_zone || "",
          difficulty_preference: profileData?.difficulty_preference || "medium",
          wake_up_goal: habitsData?.wake_up_goal || "",
          productivity_goals: habitsData?.productivity_goals || "",
          habit_preferences: habitsData?.habit_preferences || "",
        });
      } catch (err) {
        setError(err.message || "Failed to load profile and habit data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // =========================================
  // HANDLE INPUT
  // =========================================

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  // =========================================
  // SAVE PROFILE & HABITS
  // =========================================

  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const [profileResult, habitsResult] = await Promise.all([
        updateProfile({
          preferred_wake_time: formData.preferred_wake_time || null,
          sleep_duration:
            formData.sleep_duration !== ""
              ? Number(formData.sleep_duration)
              : null,
          time_zone: formData.time_zone || null,
          difficulty_preference: formData.difficulty_preference,
        }),
        updateHabits({
          wake_up_goal: formData.wake_up_goal ? formData.wake_up_goal.trim() : null,
          productivity_goals: formData.productivity_goals ? formData.productivity_goals.trim() : null,
          habit_preferences: formData.habit_preferences ? formData.habit_preferences.trim() : null,
        }),
      ]);

      const updatedProfile = profileResult?.profile || profileResult;
      const updatedHabits = habitsResult?.habits || habitsResult;

      setProfile((prev) => ({
        ...prev,
        ...updatedProfile,
      }));

      setHabits((prev) => ({
        ...prev,
        ...updatedHabits,
      }));

      // Keep form synchronized
      setFormData({
        preferred_wake_time: updatedProfile?.preferred_wake_time || "",
        sleep_duration: updatedProfile?.sleep_duration ?? "",
        time_zone: updatedProfile?.time_zone || "",
        difficulty_preference: updatedProfile?.difficulty_preference || "medium",
        wake_up_goal: updatedHabits?.wake_up_goal || "",
        productivity_goals: updatedHabits?.productivity_goals || "",
        habit_preferences: updatedHabits?.habit_preferences || "",
      });

      setMessage("Profile and habit preferences updated successfully.");
      setEditMode(false);
    } catch (err) {
      setError(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  // =========================================
  // CANCEL EDIT
  // =========================================

  function handleCancel() {
    setEditMode(false);
    setError("");
    setMessage("");

    setFormData({
      preferred_wake_time: profile?.preferred_wake_time || "",
      sleep_duration: profile?.sleep_duration ?? "",
      time_zone: profile?.time_zone || "",
      difficulty_preference: profile?.difficulty_preference || "medium",
      wake_up_goal: habits?.wake_up_goal || "",
      productivity_goals: habits?.productivity_goals || "",
      habit_preferences: habits?.habit_preferences || "",
    });
  }

  // =========================================
  // LOADING
  // =========================================

  if (loading) {
    return (
      <div className="profile-page">
        <Navbar />
        <main className="profile-container">
          <div className="profile-loading" style={{ textAlign: "center", padding: "40px" }}>
            <h2>Loading profile &amp; habit preferences...</h2>
          </div>
        </main>
      </div>
    );
  }

  // =========================================
  // UI
  // =========================================

  return (
    <div className="profile-page">
      <Navbar />

      <main className="profile-container">
        {/* =================================
            HEADER
        ================================= */}
        <div className="profile-header">
          <p>My Account</p>
          <h1>Profile &amp; Habits</h1>
          <span>Manage your profile, sleep schedule, and behavioral goals</span>
        </div>

        {/* =================================
            MESSAGES
        ================================= */}
        {error && <div className="profile-error">{error}</div>}
        {message && <div className="profile-success">{message}</div>}

        {/* =================================
            PROFILE CARD
        ================================= */}
        {profile && (
          <div className="profile-card">
            {/* Avatar */}
            <div className="profile-avatar">👤</div>

            <h2>{profile.email?.split("@")[0] || "User"}</h2>
            <p className="profile-email">{profile.email}</p>

            {/* =================================
                VIEW MODE
            ================================= */}
            {!editMode ? (
              <>
                {/* Section 1: Sleep Schedule & Core Profile */}
                <div
                  style={{
                    margin: "28px 0 14px 0",
                    textAlign: "left",
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>⏰</span>
                  <span>Sleep Schedule &amp; Preferences</span>
                </div>

                <div className="profile-details" style={{ marginTop: "10px" }}>
                  <div className="profile-detail">
                    <span>Role</span>
                    <strong>{profile.role?.toUpperCase() || "USER"}</strong>
                  </div>

                  <div className="profile-detail">
                    <span>Preferred Wake Time</span>
                    <strong>{formatWakeTime(profile.preferred_wake_time)}</strong>
                  </div>

                  <div className="profile-detail">
                    <span>Sleep Duration (Schedule)</span>
                    <strong>
                      {profile.sleep_duration !== null &&
                      profile.sleep_duration !== undefined
                        ? `${profile.sleep_duration} hours`
                        : "Not set"}
                    </strong>
                  </div>

                  <div className="profile-detail">
                    <span>Time Zone</span>
                    <strong>{profile.time_zone || "Not set"}</strong>
                  </div>

                  <div className="profile-detail" style={{ gridColumn: "span 2" }}>
                    <span>Cognitive Difficulty Preference</span>
                    <strong style={{ textTransform: "capitalize" }}>
                      {profile.difficulty_preference || "medium"}
                    </strong>
                  </div>
                </div>

                {/* Section 2: Habit Goals & Behavioral Preferences */}
                <div
                  style={{
                    margin: "34px 0 14px 0",
                    textAlign: "left",
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>🎯</span>
                  <span>Habit Goals &amp; Daily Preferences</span>
                </div>

                <div className="profile-details" style={{ marginTop: "10px" }}>
                  <div className="profile-detail" style={{ gridColumn: "span 2" }}>
                    <span>Wake-Up Goal</span>
                    <strong>{habits?.wake_up_goal || "Not set"}</strong>
                  </div>

                  <div className="profile-detail" style={{ gridColumn: "span 2" }}>
                    <span>Productivity Goals</span>
                    <strong style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {habits?.productivity_goals || "Not set"}
                    </strong>
                  </div>

                  <div className="profile-detail" style={{ gridColumn: "span 2" }}>
                    <span>Habit Preferences</span>
                    <strong style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {habits?.habit_preferences || "Not set"}
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              /* =================================
                 EDIT MODE
              ================================= */
              <>
                <div
                  style={{
                    margin: "28px 0 14px 0",
                    textAlign: "left",
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>⏰</span>
                  <span>Edit Sleep Schedule &amp; Preferences</span>
                </div>

                <div className="profile-edit-form" style={{ marginTop: "10px" }}>
                  <div className="form-group">
                    <label>Preferred Wake Time</label>
                    <input
                      type="time"
                      name="preferred_wake_time"
                      value={formData.preferred_wake_time}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Sleep Duration (Hours)</label>
                    <input
                      type="number"
                      name="sleep_duration"
                      min="0"
                      max="24"
                      placeholder="e.g. 8"
                      value={formData.sleep_duration}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Time Zone</label>
                    <input
                      type="text"
                      name="time_zone"
                      placeholder="e.g. Asia/Kolkata"
                      value={formData.time_zone}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Difficulty Preference</label>
                    <select
                      name="difficulty_preference"
                      value={formData.difficulty_preference}
                      onChange={handleChange}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    margin: "34px 0 14px 0",
                    textAlign: "left",
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>🎯</span>
                  <span>Edit Habit Goals &amp; Daily Preferences</span>
                </div>

                <div className="profile-edit-form" style={{ gridTemplateColumns: "1fr", marginTop: "10px" }}>
                  <div className="form-group">
                    <label>Wake-Up Goal</label>
                    <input
                      type="text"
                      name="wake_up_goal"
                      placeholder="e.g. Wake up at 06:30 AM feeling refreshed without snoozing"
                      value={formData.wake_up_goal}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Productivity Goals</label>
                    <textarea
                      name="productivity_goals"
                      rows={3}
                      placeholder="e.g. 30 minutes morning cognitive exercises and deep study"
                      value={formData.productivity_goals}
                      onChange={handleChange}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        borderRadius: "12px",
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Habit Preferences</label>
                    <textarea
                      name="habit_preferences"
                      rows={3}
                      placeholder="e.g. Prefer math and logic puzzles on weekdays; limit snooze to once"
                      value={formData.habit_preferences}
                      onChange={handleChange}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        borderRadius: "12px",
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* =================================
                ACTION BUTTONS
            ================================= */}
            <div className="profile-actions">
              {!editMode ? (
                <button
                  className="edit-profile-button"
                  onClick={() => setEditMode(true)}
                >
                  ✏️ Edit Profile &amp; Habits
                </button>
              ) : (
                <>
                  <button
                    className="save-profile-button"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    className="cancel-profile-button"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>

            <button
              className="back-button"
              onClick={() => navigate("/dashboard")}
              style={{ marginTop: "24px" }}
            >
              ← Back to Dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default Profile;