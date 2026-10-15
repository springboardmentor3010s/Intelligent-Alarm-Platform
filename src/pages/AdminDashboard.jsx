import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getAdminStats,
  getAdminUsers,
  updateAdminUserRole,
  deleteAdminUser,
  getAdminAlarms,
  toggleAdminAlarm,
  updateAdminAlarm,
  deleteAdminAlarm,
  getAdminSessions,
  getAdminAnalytics,
  getAdminMlMonitoring,
  getAdminSystemReportSummary,
  exportAdminSystemReportCsv,
  getAdminAnnouncements,
  createAdminAnnouncement,
  toggleAdminAnnouncement,
  deleteAdminAnnouncement,
} from "../services/api";

function AdminDashboard() {
  const navigate = useNavigate();

  // =====================================================
  // STATE
  // =====================================================

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [alarms, setAlarms] = useState([]);

  const [sessions, setSessions] = useState([]);
  const [systemAnalytics, setSystemAnalytics] =
    useState(null);
  const [mlMonitoring, setMlMonitoring] = useState(null);
  const [systemReport, setSystemReport] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    message: "",
    priority: "info",
    is_active: true,
  });
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState("");
  const [sessionFilterStatus, setSessionFilterStatus] = useState("all");
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [exportingCsv, setExportingCsv] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingAlarm, setEditingAlarm] =
    useState(null);

  // =====================================================
  // LOAD ADMIN DATA
  // =====================================================

  useEffect(() => {
    async function loadAdminData() {
      try {
        setLoading(true);
        setError("");

        const [
          statsData,
          usersData,
          alarmsData,
          sessionsData,
          analyticsData,
          mlData,
          reportData,
          announcementsData,
        ] = await Promise.all([
          getAdminStats(),
          getAdminUsers(),
          getAdminAlarms(),
          getAdminSessions(),
          getAdminAnalytics(),
          getAdminMlMonitoring().catch(() => null),
          getAdminSystemReportSummary().catch(() => null),
          getAdminAnnouncements().catch(() => []),
        ]);

        setStats(statsData);

        setUsers(
          usersData.users || []
        );

        setAlarms(
          alarmsData.alarms || []
        );

        setSessions(
          sessionsData.sessions || []
        );

        setSystemAnalytics(
          analyticsData
        );

        if (mlData) setMlMonitoring(mlData);
        if (reportData) setSystemReport(reportData);
        if (announcementsData) setAnnouncements(announcementsData);

      } catch (error) {
        console.error(
          "Admin dashboard error:",
          error
        );

        if (error.message) {
          setError(error.message);
        } else {
          setError(
            "Failed to load admin dashboard."
          );
        }
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, []);

  // =====================================================
  // CHANGE USER ROLE
  // =====================================================

  async function handleRoleChange(
    userId,
    newRole
  ) {
    try {
      await updateAdminUserRole(
        userId,
        newRole
      );

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === userId
            ? {
                ...user,
                role: newRole,
              }
            : user
        )
      );

    } catch (error) {
      alert(
        error.message ||
          "Failed to update user role."
      );
    }
  }

  // =====================================================
  // EXPORT SYSTEM REPORT CSV
  // =====================================================

  async function handleExportCsv() {
    try {
      setExportingCsv(true);
      await exportAdminSystemReportCsv();
    } catch (err) {
      alert(err.message || "Failed to export system report CSV.");
    } finally {
      setExportingCsv(false);
    }
  }

  // =====================================================
  // ANNOUNCEMENTS MANAGEMENT (Phase 5)
  // =====================================================

  async function handleCreateAnnouncement(e) {
    e.preventDefault();
    if (!newAnnouncement.title.trim() || !newAnnouncement.message.trim()) return;
    try {
      setCreatingAnnouncement(true);
      setAnnouncementMsg("");
      const created = await createAdminAnnouncement(newAnnouncement);
      setAnnouncements((prev) => [created, ...prev]);
      setNewAnnouncement({ title: "", message: "", priority: "info", is_active: true });
      setAnnouncementMsg("Announcement created successfully!");
      setTimeout(() => setAnnouncementMsg(""), 3500);
    } catch (err) {
      setAnnouncementMsg("Failed to create announcement: " + (err.message || "Unknown error"));
    } finally {
      setCreatingAnnouncement(false);
    }
  }

  async function handleToggleAnnouncement(id) {
    try {
      const updated = await toggleAdminAnnouncement(id);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? updated : a))
      );
    } catch (err) {
      alert("Failed to toggle announcement: " + (err.message || ""));
    }
  }

  async function handleDeleteAnnouncement(id) {
    if (!window.confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await deleteAdminAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert("Failed to delete announcement: " + (err.message || ""));
    }
  }

  // =====================================================
  // DELETE USER
  // =====================================================

  async function handleDeleteUser(
    userId,
    email
  ) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${email}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteAdminUser(userId);

      setUsers((currentUsers) =>
        currentUsers.filter(
          (user) => user.id !== userId
        )
      );

      setStats((currentStats) => {
        if (!currentStats) {
          return currentStats;
        }

        return {
          ...currentStats,
          total_users:
            Math.max(
              0,
              currentStats.total_users - 1
            ),
        };
      });

    } catch (error) {
      alert(
        error.message ||
          "Failed to delete user."
      );
    }
  }

  // =====================================================
  // TOGGLE ALARM
  // =====================================================

  async function handleToggleAlarm(
    alarmId
  ) {
    try {
      const data =
        await toggleAdminAlarm(
          alarmId
        );

      setAlarms((currentAlarms) =>
        currentAlarms.map((alarm) =>
          alarm.id === alarmId
            ? {
                ...alarm,
                is_active:
                  data.alarm.is_active,
              }
            : alarm
        )
      );

    } catch (error) {
      alert(
        error.message ||
          "Failed to toggle alarm."
      );
    }
  }

  // =====================================================
  // DELETE ALARM
  // =====================================================

  async function handleDeleteAlarm(
    alarmId,
    alarmName
  ) {
    const confirmed = window.confirm(
      `Delete alarm "${alarmName}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteAdminAlarm(
        alarmId
      );

      setAlarms((currentAlarms) =>
        currentAlarms.filter(
          (alarm) =>
            alarm.id !== alarmId
        )
      );

      setStats((currentStats) => {
        if (!currentStats) {
          return currentStats;
        }

        return {
          ...currentStats,
          total_alarms:
            Math.max(
              0,
              currentStats.total_alarms - 1
            ),
        };
      });

    } catch (error) {
      alert(
        error.message ||
          "Failed to delete alarm."
      );
    }
  }

  // =====================================================
  // UPDATE ALARM
  // =====================================================

  async function handleUpdateAlarm(
    alarmId,
    formData
  ) {
    try {
      const data =
        await updateAdminAlarm(
          alarmId,
          formData
        );

      setAlarms((currentAlarms) =>
        currentAlarms.map((alarm) =>
          alarm.id === alarmId
            ? data.alarm
            : alarm
        )
      );

      setEditingAlarm(null);

    } catch (error) {
      alert(
        error.message ||
          "Failed to update alarm."
      );
    }
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  function handleLogout() {
    localStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem("user");

    navigate("/login");
  }

  // =====================================================
  // FORMAT DATE
  // =====================================================

  function formatDate(dateValue) {
    if (!dateValue) {
      return "-";
    }

    try {
      return new Date(
        dateValue
      ).toLocaleString();
    } catch {
      return "-";
    }
  }

  // =====================================================
  // FORMAT DURATION
  // =====================================================

  function formatDuration(seconds) {
    if (
      seconds === null ||
      seconds === undefined
    ) {
      return "-";
    }

    const rounded =
      Math.round(seconds);

    if (rounded < 60) {
      return `${rounded}s`;
    }

    const minutes =
      Math.floor(rounded / 60);

    const remainingSeconds =
      rounded % 60;

    return `${minutes}m ${remainingSeconds}s`;
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="admin-loading">
        <div>
          <h2>
            Loading Admin Dashboard...
          </h2>

          <p>
            Please wait...
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // ERROR
  // =====================================================

  if (error) {
    return (
      <div className="admin-error-page">

        <div className="admin-error-card">

          <div className="admin-error-icon">
            🔒
          </div>

          <h1>
            Access Denied
          </h1>

          <p>
            {error}
          </p>

          <button
            className="back-dashboard-button"
            onClick={() =>
              navigate("/dashboard")
            }
          >
            Back to Dashboard
          </button>

        </div>

      </div>
    );
  }

  // =====================================================
  // FILTERED SESSIONS
  // =====================================================

  const filteredSessions = sessions.filter((session) => {
    if (sessionFilterStatus !== "all" && session.session_status !== sessionFilterStatus) {
      return false;
    }
    if (sessionSearchQuery.trim()) {
      const q = sessionSearchQuery.toLowerCase();
      const uName = (session.user_name || "").toLowerCase();
      const uEmail = (session.user_email || "").toLowerCase();
      const aName = (session.alarm_name || "").toLowerCase();
      return uName.includes(q) || uEmail.includes(q) || aName.includes(q);
    }
    return true;
  });

  // =====================================================
  // ADMIN DASHBOARD
  // =====================================================

  return (
    <div className="admin-page">

      <main className="admin-container">

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="admin-header">

          <div>

            <p className="admin-label">
              Administration
            </p>

            <h1>
              Admin Dashboard
            </h1>

            <p className="admin-subtitle">
              System management and monitoring
            </p>

          </div>

          <button
            className="admin-logout"
            onClick={handleLogout}
          >
            Logout
          </button>

        </header>


        {/* =================================================
            WELCOME
        ================================================= */}

        <section className="admin-welcome">

          <span>
            Welcome back,
          </span>

          <strong>
            KIRAN
          </strong>

          <span>
            🛡️
          </span>

        </section>


        {/* =================================================
            STATISTICS
        ================================================= */}

        {stats && (

          <section className="admin-stats">

            {/* TOTAL USERS */}

            <div className="admin-stat-card">

              <div className="admin-stat-icon">
                👥
              </div>

              <div>

                <p>
                  Total Users
                </p>

                <h2>
                  {stats.total_users}
                </h2>

              </div>

            </div>


            {/* TOTAL COACHES */}

            <div className="admin-stat-card">

              <div className="admin-stat-icon">
                🩺
              </div>

              <div>

                <p>
                  Wellness Coaches
                </p>

                <h2>
                  {stats.total_coaches ?? 0}
                </h2>

              </div>

            </div>


            {/* TOTAL ALARMS */}

            <div className="admin-stat-card">

              <div className="admin-stat-icon">
                ⏰
              </div>

              <div>

                <p>
                  Total Alarms
                </p>

                <h2>
                  {stats.total_alarms}
                </h2>

              </div>

            </div>


            {/* TOTAL SESSIONS */}

            <div className="admin-stat-card">

              <div className="admin-stat-icon">
                🧠
              </div>

              <div>

                <p>
                  Total Sessions
                </p>

                <h2>
                  {stats.total_sessions}
                </h2>

              </div>

            </div>


            {/* COMPLETED SESSIONS */}

            <div className="admin-stat-card">

              <div className="admin-stat-icon">
                ✅
              </div>

              <div>

                <p>
                  Completed Sessions
                </p>

                <h2>
                  {stats.completed_sessions}
                </h2>

              </div>

            </div>

          </section>

        )}


        {/* =================================================
            USER MANAGEMENT
        ================================================= */}

        <section className="admin-section">

          <div className="admin-section-header">

            <div>

              <p className="admin-section-label">
                Administration
              </p>

              <h2>
                User Management
              </h2>

            </div>

            <span className="user-count">
              {users.length} users
            </span>

          </div>


          {/* USER TABLE */}

          <div className="admin-table-wrapper">

            <table className="admin-table">

              <thead>

                <tr>

                  <th>
                    ID
                  </th>

                  <th>
                    Email
                  </th>

                  <th>
                    Role
                  </th>

                  <th>
                    Action
                  </th>

                </tr>

              </thead>


              <tbody>

                {users.length === 0 ? (

                  <tr>

                    <td
                      colSpan="4"
                      className="no-users"
                    >
                      No users found
                    </td>

                  </tr>

                ) : (

                  users.map((user) => {

                    const loggedInUser =
                      JSON.parse(
                        localStorage.getItem(
                          "user"
                        ) || "{}"
                      );

                    const isCurrentAdmin =
                      loggedInUser.id ===
                      user.id;

                    return (

                      <tr
                        key={user.id}
                      >

                        <td>
                          {user.id}
                        </td>


                        <td className="user-email">
                          {user.email}
                        </td>


                        <td>

                          {isCurrentAdmin ? (

                            <span className="admin-role-badge">
                              ADMIN
                            </span>

                          ) : (

                            <select
                              value={user.role}
                              onChange={(event) =>
                                handleRoleChange(
                                  user.id,
                                  event.target.value
                                )
                              }
                              className="role-select"
                            >

                              <option value="user">
                                User
                              </option>

                              <option value="wellness_coach">
                                Wellness Coach
                              </option>

                              <option value="admin">
                                Admin
                              </option>

                            </select>

                          )}

                        </td>


                        <td>

                          {isCurrentAdmin ? (

                            <span className="current-admin">
                              Current Admin
                            </span>

                          ) : (

                            <button
                              type="button"
                              className="delete-user-button"
                              onClick={() =>
                                handleDeleteUser(
                                  user.id,
                                  user.email
                                )
                              }
                            >
                              Delete
                            </button>

                          )}

                        </td>

                      </tr>

                    );

                  })

                )}

              </tbody>

            </table>

          </div>

        </section>


        {/* =================================================
            ALARM MANAGEMENT
        ================================================= */}

        <section className="admin-section">

          <div className="admin-section-header">

            <div>

              <p className="admin-section-label">
                System Management
              </p>

              <h2>
                Alarm Management
              </h2>

            </div>

            <span className="user-count">
              {alarms.length} alarms
            </span>

          </div>


          <div className="admin-table-wrapper">

            <table className="admin-table">

              <thead>

                <tr>

                  <th>
                    ID
                  </th>

                  <th>
                    User ID
                  </th>

                  <th>
                    Alarm
                  </th>

                  <th>
                    Time
                  </th>

                  <th>
                    Type
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Actions
                  </th>

                </tr>

              </thead>


              <tbody>

                {alarms.length === 0 ? (

                  <tr>

                    <td
                      colSpan="7"
                      className="no-users"
                    >
                      No alarms found
                    </td>

                  </tr>

                ) : (

                  alarms.map((alarm) => (

                    <tr
                      key={alarm.id}
                    >

                      <td>
                        {alarm.id}
                      </td>

                      <td>
                        {alarm.user_id}
                      </td>

                      <td className="user-email">
                        {alarm.name ||
                          "Unnamed Alarm"}
                      </td>

                      <td>
                        {alarm.alarm_time}
                      </td>

                      <td>
                        {alarm.alarm_type}
                      </td>

                      <td>

                        <span
                          className={
                            alarm.is_active
                              ? "active-alarm-badge"
                              : "inactive-alarm-badge"
                          }
                        >
                          {alarm.is_active
                            ? "ACTIVE"
                            : "INACTIVE"}
                        </span>

                      </td>


                      <td>

                        <div className="alarm-actions">

                          {/* ENABLE / DISABLE */}

                          <button
                            type="button"
                            className="toggle-alarm-button"
                            onClick={() =>
                              handleToggleAlarm(
                                alarm.id
                              )
                            }
                          >
                            {alarm.is_active
                              ? "Disable"
                              : "Enable"}
                          </button>


                          {/* EDIT */}

                          <button
                            type="button"
                            className="edit-alarm-button"
                            onClick={() =>
                              setEditingAlarm(
                                alarm
                              )
                            }
                          >
                            Edit
                          </button>


                          {/* DELETE */}

                          <button
                            type="button"
                            className="delete-alarm-button"
                            onClick={() =>
                              handleDeleteAlarm(
                                alarm.id,
                                alarm.name
                              )
                            }
                          >
                            Delete
                          </button>

                        </div>

                      </td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

        </section>


        {/* =================================================
            EDIT ALARM
        ================================================= */}

        {editingAlarm && (

          <section className="admin-section alarm-edit-section">

            <div className="admin-section-header">

              <div>

                <p className="admin-section-label">
                  Alarm Management
                </p>

                <h2>
                  Edit Alarm
                </h2>

              </div>

            </div>


            <form
              className="alarm-edit-form"
              onSubmit={(event) => {

                event.preventDefault();

                const form =
                  new FormData(
                    event.currentTarget
                  );

                handleUpdateAlarm(
                  editingAlarm.id,
                  {
                    name:
                      form.get("name"),

                    alarm_time:
                      form.get(
                        "alarm_time"
                      ),

                    alarm_type:
                      form.get(
                        "alarm_type"
                      ),

                    repeat_pattern:
                      form.get(
                        "repeat_pattern"
                      ),

                    is_active:
                      form.get(
                        "is_active"
                      ) === "true",
                  }
                );

              }}
            >

              {/* ALARM NAME */}

              <div className="form-group">

                <label>
                  Alarm Name
                </label>

                <input
                  name="name"
                  defaultValue={
                    editingAlarm.name ||
                    ""
                  }
                  required
                />

              </div>


              {/* ALARM TIME */}

              <div className="form-group">

                <label>
                  Alarm Time
                </label>

                <input
                  type="time"
                  name="alarm_time"
                  defaultValue={
                    editingAlarm.alarm_time
                      ?.slice(0, 5)
                  }
                  required
                />

              </div>


              {/* ALARM TYPE */}

              <div className="form-group">

                <label>
                  Alarm Type
                </label>

                <input
                  name="alarm_type"
                  defaultValue={
                    editingAlarm.alarm_type ||
                    ""
                  }
                />

              </div>


              {/* REPEAT PATTERN */}

              <div className="form-group">

                <label>
                  Repeat Pattern
                </label>

                <input
                  name="repeat_pattern"
                  defaultValue={
                    editingAlarm.repeat_pattern ||
                    ""
                  }
                />

              </div>


              {/* STATUS */}

              <div className="form-group">

                <label>
                  Status
                </label>

                <select
                  name="is_active"
                  defaultValue={
                    editingAlarm.is_active
                      ? "true"
                      : "false"
                  }
                >

                  <option value="true">
                    Active
                  </option>

                  <option value="false">
                    Inactive
                  </option>

                </select>

              </div>


              {/* FORM ACTIONS */}

              <div className="profile-actions">

                <button
                  type="submit"
                  className="save-profile-button"
                >
                  Save Changes
                </button>

                <button
                  type="button"
                  className="cancel-profile-button"
                  onClick={() =>
                    setEditingAlarm(null)
                  }
                >
                  Cancel
                </button>

              </div>

            </form>

          </section>

        )}


        {/* =================================================
            SESSION MONITORING
        ================================================= */}

        <section className="admin-section">

          <div className="admin-section-header">

            <div>

              <p className="admin-section-label">
                Performance Monitoring
              </p>

              <h2>
                Session Monitoring
              </h2>

            </div>

            <span className="user-count">
              {filteredSessions.length} of {sessions.length} sessions
            </span>

          </div>

          {/* SESSION FILTERS */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search by user, email, or alarm..."
              value={sessionSearchQuery}
              onChange={(e) => setSessionSearchQuery(e.target.value)}
              className="role-select"
              style={{ flex: 1, minWidth: "220px" }}
            />
            <select
              value={sessionFilterStatus}
              onChange={(e) => setSessionFilterStatus(e.target.value)}
              className="role-select"
            >
              <option value="all">All Session Statuses</option>
              <option value="completed">Completed</option>
              <option value="started">Started / Active</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div className="admin-table-wrapper">

            <table className="admin-table">

              <thead>

                <tr>

                  <th>
                    ID
                  </th>

                  <th>
                    User
                  </th>

                  <th>
                    Email
                  </th>

                  <th>
                    Alarm
                  </th>

                  <th>
                    Challenge
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Result
                  </th>

                  <th>
                    Started
                  </th>

                  <th>
                    Duration
                  </th>

                </tr>

              </thead>


              <tbody>

                {filteredSessions.length === 0 ? (

                  <tr>

                    <td
                      colSpan="9"
                      className="no-users"
                    >
                      No sessions matching criteria
                    </td>

                  </tr>

                ) : (

                  filteredSessions.map((session) => (

                    <tr
                      key={session.id}
                    >

                      <td>
                        {session.id}
                      </td>


                      <td className="user-email">
                        {session.user_name ||
                          "-"}
                      </td>


                      <td>
                        {session.user_email ||
                          "-"}
                      </td>


                      <td className="user-email">
                        {session.alarm_name ||
                          "-"}
                      </td>


                      <td>
                        {session.challenge_type ||
                          "-"}
                      </td>


                      <td>

                        <span
                          className={
                            session.session_status ===
                            "completed"
                              ? "completed-session-badge"
                              : "pending-session-badge"
                          }
                        >
                          {session.session_status
                            ?.toUpperCase() ||
                            "-"}
                        </span>

                      </td>


                      <td>

                        {session.is_correct ===
                        true ? (

                          <span className="correct-session-badge">
                            ✓ Correct
                          </span>

                        ) : session.is_correct ===
                          false ? (

                          <span className="wrong-session-badge">
                            ✕ Wrong
                          </span>

                        ) : (

                          <span className="pending-session-badge">
                            Pending
                          </span>

                        )}

                      </td>


                      <td>
                        {formatDate(
                          session.started_at
                        )}
                      </td>


                      <td>
                        {formatDuration(
                          session.duration_seconds
                        )}
                      </td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

        </section>


        {/* =================================================
            SYSTEM ANALYTICS
        ================================================= */}

        {systemAnalytics && (

          <section className="admin-section">

            <div className="admin-section-header">

              <div>

                <p className="admin-section-label">
                  System Performance
                </p>

                <h2>
                  System Analytics
                </h2>

              </div>

            </div>


            {/* ANALYTICS STATISTICS */}

            <div className="admin-analytics-grid">

              {/* USERS */}

              <div className="admin-analytics-card">

                <span className="admin-analytics-icon">
                  👥
                </span>

                <div>

                  <p>
                    Total Users
                  </p>

                  <h3>
                    {
                      systemAnalytics.total_users
                    }
                  </h3>

                </div>

              </div>


              {/* ALARMS */}

              <div className="admin-analytics-card">

                <span className="admin-analytics-icon">
                  ⏰
                </span>

                <div>

                  <p>
                    Total Alarms
                  </p>

                  <h3>
                    {
                      systemAnalytics.total_alarms
                    }
                  </h3>

                </div>

              </div>


              {/* ACTIVE ALARMS */}

              <div className="admin-analytics-card">

                <span className="admin-analytics-icon">
                  🔔
                </span>

                <div>

                  <p>
                    Active Alarms
                  </p>

                  <h3>
                    {
                      systemAnalytics.active_alarms
                    }
                  </h3>

                </div>

              </div>


              {/* SESSIONS */}

              <div className="admin-analytics-card">

                <span className="admin-analytics-icon">
                  🧠
                </span>

                <div>

                  <p>
                    Total Sessions
                  </p>

                  <h3>
                    {
                      systemAnalytics.total_sessions
                    }
                  </h3>

                </div>

              </div>


              {/* COMPLETED */}

              <div className="admin-analytics-card">

                <span className="admin-analytics-icon">
                  ✅
                </span>

                <div>

                  <p>
                    Completed
                  </p>

                  <h3>
                    {
                      systemAnalytics.completed_sessions
                    }
                  </h3>

                </div>

              </div>


              {/* CORRECT */}

              <div className="admin-analytics-card">

                <span className="admin-analytics-icon">
                  🎯
                </span>

                <div>

                  <p>
                    Correct Answers
                  </p>

                  <h3>
                    {
                      systemAnalytics.correct_answers
                    }
                  </h3>

                </div>

              </div>


              {/* WRONG */}

              <div className="admin-analytics-card">

                <span className="admin-analytics-icon">
                  ❌
                </span>

                <div>

                  <p>
                    Wrong Answers
                  </p>

                  <h3>
                    {
                      systemAnalytics.wrong_answers
                    }
                  </h3>

                </div>

              </div>


              {/* ACCURACY */}

              <div className="admin-analytics-card">

                <span className="admin-analytics-icon">
                  📈
                </span>

                <div>

                  <p>
                    System Accuracy
                  </p>

                  <h3>
                    {
                      systemAnalytics.accuracy
                    }%
                  </h3>

                </div>

              </div>

            </div>


            {/* OVERALL ACCURACY */}

            <div className="admin-accuracy-card">

              <div>

                <p className="admin-section-label">
                  OVERALL ACCURACY
                </p>

                <h2>
                  {
                    systemAnalytics.accuracy
                  }%
                </h2>

                <p>
                  Based on all completed
                  cognitive challenge
                  answers.
                </p>

              </div>


              <div
                className="admin-accuracy-circle"
                style={{
                  background:
                    `conic-gradient(
                      #0b91d1 ${
                        systemAnalytics.accuracy
                      }%,
                      #e5edf3 0
                    )`,
                }}
              >

                <span>
                  {
                    systemAnalytics.accuracy
                  }%
                </span>

              </div>

            </div>


            {/* CORRECT VS WRONG */}

            <div className="admin-results-card">

              <p className="admin-section-label">
                RESULTS
              </p>

              <h3>
                Correct vs Wrong Answers
              </h3>


              {/* CORRECT */}

              <div className="admin-result-row">

                <div className="admin-result-label">

                  <span>
                    Correct
                  </span>

                  <strong>
                    {
                      systemAnalytics.correct_answers
                    }
                  </strong>

                </div>

                <div className="admin-result-bar">

                  <div
                    className="admin-correct-bar"
                    style={{
                      width:
                        systemAnalytics.total_sessions >
                        0
                          ? `${
                              (
                                systemAnalytics.correct_answers /
                                systemAnalytics.total_sessions
                              ) * 100
                            }%`
                          : "0%",
                    }}
                  />

                </div>

              </div>


              {/* WRONG */}

              <div className="admin-result-row">

                <div className="admin-result-label">

                  <span>
                    Wrong
                  </span>

                  <strong>
                    {
                      systemAnalytics.wrong_answers
                    }
                  </strong>

                </div>

                <div className="admin-result-bar">

                  <div
                    className="admin-wrong-bar"
                    style={{
                      width:
                        systemAnalytics.total_sessions >
                        0
                          ? `${
                              (
                                systemAnalytics.wrong_answers /
                                systemAnalytics.total_sessions
                              ) * 100
                            }%`
                          : "0%",
                    }}
                  />

                </div>

              </div>

            </div>

          </section>

        )}


        {/* =================================================
            ML & RECOMMENDATION MONITORING
        ================================================= */}

        {mlMonitoring && (
          <section className="admin-section">
            <div className="admin-section-header">
              <div>
                <p className="admin-section-label">
                  Artificial Intelligence
                </p>
                <h2>
                  Machine Learning & Recommendation Monitoring
                </h2>
              </div>

              <span
                className="user-count"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background:
                      mlMonitoring.model_status?.status === "online"
                        ? "#10b981"
                        : "#ef4444",
                    display: "inline-block",
                  }}
                />
                {mlMonitoring.model_status?.status?.toUpperCase()} (v
                {mlMonitoring.model_status?.model_version})
              </span>
            </div>

            {/* Model Details & Synthetic Benchmark Notice */}
            <div
              style={{
                background: "rgba(59, 130, 246, 0.08)",
                border: "1px solid rgba(59, 130, 246, 0.25)",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "8px",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "16px" }}>
                  Algorithm: {mlMonitoring.model_status?.algorithm}
                </h3>
                <span style={{ fontSize: "12px", opacity: 0.8 }}>
                  Trained:{" "}
                  {mlMonitoring.model_status?.trained_at
                    ? new Date(
                        mlMonitoring.model_status.trained_at
                      ).toLocaleDateString()
                    : "Built-in"}
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "var(--text-muted, #94a3b8)",
                  lineHeight: "1.5",
                }}
              >
                ℹ️ <strong>Dataset Notice:</strong>{" "}
                {mlMonitoring.model_status?.dataset_notice}
              </p>
              <p
                style={{
                  margin: "6px 0 0 0",
                  fontSize: "12px",
                  color: "#f59e0b",
                }}
              >
                ⚠️ <em>{mlMonitoring.recommendation_activity?.disclaimer}</em>
              </p>
            </div>

            {/* Benchmark Metrics Grid */}
            <p
              className="admin-section-label"
              style={{ marginBottom: "12px" }}
            >
              SYNTHETIC BENCHMARK EVALUATION
            </p>

            <div
              className="admin-analytics-grid"
              style={{ marginBottom: "24px" }}
            >
              <div className="admin-analytics-card">
                <span className="admin-analytics-icon">🎯</span>
                <div>
                  <p>Accuracy</p>
                  <h3>
                    {(
                      (mlMonitoring.model_status?.benchmark_metrics
                        ?.accuracy || 0) * 100
                    ).toFixed(1)}
                    %
                  </h3>
                </div>
              </div>

              <div className="admin-analytics-card">
                <span className="admin-analytics-icon">📊</span>
                <div>
                  <p>ROC-AUC</p>
                  <h3>
                    {(
                      (mlMonitoring.model_status?.benchmark_metrics
                        ?.roc_auc || 0) * 100
                    ).toFixed(1)}
                    %
                  </h3>
                </div>
              </div>

              <div className="admin-analytics-card">
                <span className="admin-analytics-icon">⚖️</span>
                <div>
                  <p>F1 Score</p>
                  <h3>
                    {(
                      (mlMonitoring.model_status?.benchmark_metrics?.f1 ||
                        0) * 100
                    ).toFixed(1)}
                    %
                  </h3>
                </div>
              </div>

              <div className="admin-analytics-card">
                <span className="admin-analytics-icon">🔍</span>
                <div>
                  <p>Brier Score</p>
                  <h3>
                    {(
                      mlMonitoring.model_status?.benchmark_metrics
                        ?.brier_score || 0
                    ).toFixed(4)}
                  </h3>
                </div>
              </div>
            </div>

            {/* Platform ML Adoption & Features */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "16px",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <h4 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>
                  Top Predictive Features
                </h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {(mlMonitoring.model_status?.top_features || []).map(
                    (feat, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "13px",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "monospace",
                            opacity: 0.9,
                          }}
                        >
                          {feat.feature}
                        </span>
                        <strong style={{ color: "#38bdf8" }}>
                          {(feat.importance * 100).toFixed(1)}%
                        </strong>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <h4 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>
                  Platform ML Adoption
                </h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    fontSize: "13px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Engine Architecture</span>
                    <strong style={{ color: "#10b981" }}>
                      XGBoost + Rule Fallback
                    </strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>User Profiles Configured</span>
                    <strong>
                      {mlMonitoring.platform_ml_adoption
                        ?.total_profiles_configured || 0}
                    </strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Evaluated Alarm Sessions</span>
                    <strong>
                      {mlMonitoring.platform_ml_adoption
                        ?.total_evaluated_sessions || 0}
                    </strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Platform Avg Habit Score</span>
                    <strong style={{ color: "#a855f7" }}>
                      {mlMonitoring.platform_ml_adoption
                        ?.platform_avg_habit_score || 60}
                      /100
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}


        {/* =================================================
            SYSTEM REPORTS & EXPORTS
        ================================================= */}

        {systemReport && (
          <section className="admin-section">
            <div className="admin-section-header">
              <div>
                <p className="admin-section-label">
                  Reporting & Compliance
                </p>
                <h2>System Reports & Export</h2>
              </div>
              <button
                type="button"
                className="manage-button"
                disabled={exportingCsv}
                onClick={handleExportCsv}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: exportingCsv ? "wait" : "pointer",
                }}
              >
                <span>📥</span>
                {exportingCsv ? "Exporting..." : "Download System CSV"}
              </button>
            </div>

            {/* Cognitive Challenge Breakdown */}
            <p
              className="admin-section-label"
              style={{ marginBottom: "12px" }}
            >
              COGNITIVE CHALLENGE PERFORMANCE
            </p>

            <div
              className="admin-table-wrapper"
              style={{ marginBottom: "20px" }}
            >
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Challenge Type</th>
                    <th>Question Bank</th>
                    <th>Sessions Played</th>
                    <th>Correct Answers</th>
                    <th>Accuracy Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(
                    systemReport.challenge_breakdown || {}
                  ).map(([cType, stats]) => (
                    <tr key={cType}>
                      <td
                        style={{
                          textTransform: "capitalize",
                          fontWeight: 600,
                        }}
                      >
                        {cType}
                      </td>
                      <td>{stats.total_questions} questions</td>
                      <td>{stats.sessions_played}</td>
                      <td>{stats.correct_answers}</td>
                      <td>
                        <span
                          className={
                            stats.accuracy_rate >= 70
                              ? "correct-session-badge"
                              : "pending-session-badge"
                          }
                        >
                          {stats.accuracy_rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Security Guarantee Banner */}
            <div
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                borderRadius: "10px",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span>🛡️</span>
              <span style={{ fontSize: "13px", color: "#10b981" }}>
                <strong>Security Guarantee:</strong>{" "}
                {systemReport.data_safety_certification}
              </span>
            </div>
          </section>
        )}

        {/* =================================================
            PLATFORM ANNOUNCEMENTS & BROADCASTS (Phase 5)
        ================================================= */}

        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <p className="admin-section-label">
                Communication & Notifications
              </p>
              <h2>Platform Announcements & Broadcasts</h2>
            </div>
            <span
              style={{
                fontSize: "12px",
                background: "rgba(59, 130, 246, 0.1)",
                color: "#3b82f6",
                padding: "4px 10px",
                borderRadius: "99px",
                fontWeight: 600,
              }}
            >
              {announcements.length} Total Announcements
            </span>
          </div>

          {/* Create Announcement Form */}
          <form
            onSubmit={handleCreateAnnouncement}
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "16px 20px",
              marginBottom: "24px",
            }}
          >
            <p
              className="admin-section-label"
              style={{ marginBottom: "12px", fontSize: "11px" }}
            >
              CREATE NEW BROADCAST ANNOUNCEMENT
            </p>
            {announcementMsg && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  marginBottom: "12px",
                  fontSize: "13px",
                  background: announcementMsg.includes("Failed")
                    ? "rgba(239, 68, 68, 0.1)"
                    : "rgba(16, 185, 129, 0.1)",
                  color: announcementMsg.includes("Failed") ? "#ef4444" : "#10b981",
                }}
              >
                {announcementMsg}
              </div>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 140px",
                gap: "12px",
                marginBottom: "12px",
              }}
            >
              <input
                type="text"
                placeholder="Announcement Title (e.g., Scheduled Maintenance)"
                value={newAnnouncement.title}
                onChange={(e) =>
                  setNewAnnouncement((prev) => ({ ...prev, title: e.target.value }))
                }
                required
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background: "rgba(0,0,0,0.2)",
                  color: "inherit",
                  fontSize: "14px",
                }}
              />
              <select
                value={newAnnouncement.priority}
                onChange={(e) =>
                  setNewAnnouncement((prev) => ({ ...prev, priority: e.target.value }))
                }
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background: "rgba(0,0,0,0.2)",
                  color: "inherit",
                  fontSize: "13px",
                }}
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <textarea
                placeholder="Announcement message displayed to all platform users..."
                rows={2}
                value={newAnnouncement.message}
                onChange={(e) =>
                  setNewAnnouncement((prev) => ({ ...prev, message: e.target.value }))
                }
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background: "rgba(0,0,0,0.2)",
                  color: "inherit",
                  fontSize: "14px",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                className="manage-button"
                disabled={creatingAnnouncement}
                style={{ cursor: creatingAnnouncement ? "wait" : "pointer" }}
              >
                📢 {creatingAnnouncement ? "Publishing..." : "Publish Announcement"}
              </button>
            </div>
          </form>

          {/* Announcements Table */}
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title & Content</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {announcements.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "24px", opacity: 0.6 }}>
                      No announcements published yet.
                    </td>
                  </tr>
                ) : (
                  announcements.map((item) => (
                    <tr key={item.id}>
                      <td style={{ maxWidth: "340px" }}>
                        <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "3px" }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: "12px", opacity: 0.75, whiteSpace: "normal" }}>
                          {item.message}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            background:
                              item.priority === "critical"
                                ? "rgba(239, 68, 68, 0.15)"
                                : item.priority === "warning"
                                ? "rgba(245, 158, 11, 0.15)"
                                : "rgba(59, 130, 246, 0.15)",
                            color:
                              item.priority === "critical"
                                ? "#ef4444"
                                : item.priority === "warning"
                                ? "#f59e0b"
                                : "#3b82f6",
                          }}
                        >
                          {item.priority}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            item.is_active
                              ? "correct-session-badge"
                              : "pending-session-badge"
                          }
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", opacity: 0.7 }}>
                        {formatDate(item.created_at)}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            className="manage-button"
                            onClick={() => handleToggleAnnouncement(item.id)}
                            style={{ padding: "4px 8px", fontSize: "12px" }}
                          >
                            {item.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            className="delete-button"
                            onClick={() => handleDeleteAnnouncement(item.id)}
                            style={{ padding: "4px 8px", fontSize: "12px" }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* =================================================
            ADMIN INFORMATION
        ================================================= */}

        <section className="admin-info">

          <div className="admin-info-icon">
            🛡️
          </div>

          <div>

            <h3>
              Administrator Access
            </h3>

            <p>
              You have administrator privileges.
              You can manage users, alarms,
              sessions and system analytics
              from this dashboard.
            </p>

          </div>

        </section>


      </main>

    </div>
  );
}

export default AdminDashboard;