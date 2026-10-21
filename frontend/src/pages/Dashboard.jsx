import { useEffect, useState } from "react";

import {
  getAlarms,
  createAlarm,
  deleteAlarm,
  snoozeAlarm,
  completeAlarm,
  logoutUser
} from "../services/api";


function Dashboard({ user, onLogout }) {

  const [alarms, setAlarms] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);


  const [title, setTitle] = useState("");

  const [description, setDescription] = useState("");

  const [alarmTime, setAlarmTime] = useState("07:00");

  const [alarmType, setAlarmType] = useState("daily");

  const [days, setDays] = useState(
    "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday"
  );

  const [difficulty, setDifficulty] = useState("medium");

  const [challengeType, setChallengeType] = useState("math");

  const [isSmart, setIsSmart] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getAlarms()
      .then((data) => {
        if (!cancelled) setAlarms(data);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setError(err.response?.data?.detail || "Unable to load alarms.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);


  // ====================================
  // CREATE ALARM
  // ====================================

  async function handleCreateAlarm(event) {

    event.preventDefault();

    try {

      setError("");

      const newAlarm = await createAlarm({

        title: title,

        description: description,

        alarm_time: alarmTime,

        alarm_type: alarmType,

        days: days,

        difficulty: difficulty,

        challenge_type: challengeType,

        is_smart: isSmart,

        is_active: true

      });

      setAlarms((previous) => [
        ...previous,
        newAlarm
      ]);

      setTitle("");

      setDescription("");

      setAlarmTime("07:00");

      setShowForm(false);

    } catch (err) {

      console.error(err);

      setError(
        err.response?.data?.detail ||
        "Unable to create alarm."
      );

    }
  }


  // ====================================
  // DELETE
  // ====================================

  async function handleDelete(id) {

    if (!window.confirm(
      "Are you sure you want to delete this alarm?"
    )) {
      return;
    }

    try {

      await deleteAlarm(id);

      setAlarms((previous) =>
        previous.filter(
          (alarm) => alarm.id !== id
        )
      );

    } catch (err) {

      console.error(err);

      setError(
        err.response?.data?.detail ||
        "Unable to delete alarm."
      );

    }
  }


  // ====================================
  // SNOOZE
  // ====================================

  async function handleSnooze(id) {

    try {

      const updatedAlarm =
        await snoozeAlarm(id);

      setAlarms((previous) =>
        previous.map((alarm) =>
          alarm.id === id
            ? updatedAlarm
            : alarm
        )
      );

    } catch (err) {

      console.error(err);

      setError(
        err.response?.data?.detail ||
        "Unable to snooze alarm."
      );

    }
  }


  // ====================================
  // COMPLETE
  // ====================================

  async function handleComplete(id) {

    try {

      const updatedAlarm =
        await completeAlarm(id);

      setAlarms((previous) =>
        previous.map((alarm) =>
          alarm.id === id
            ? updatedAlarm
            : alarm
        )
      );

    } catch (err) {

      console.error(err);

      setError(
        err.response?.data?.detail ||
        "Unable to complete alarm."
      );

    }
  }


  // ====================================
  // LOGOUT
  // ====================================

  function handleLogout() {

    logoutUser();

    onLogout();

  }


  return (

    <div className="dashboard-page">

      {/* ================= HEADER ================= */}

      <header className="dashboard-header">

        <div>

          <div className="dashboard-logo">
            🧠
          </div>

          <div>

            <h1>Cognitive Alarm</h1>

            <p>
              Wake your mind. Start your day smarter.
            </p>

          </div>

        </div>


        <button
          className="logout-button"
          onClick={handleLogout}
        >
          Logout
        </button>

      </header>


      {/* ================= WELCOME ================= */}

      <section className="welcome-section">

        <h2>
          Welcome, {user?.name} 👋
        </h2>

        <p>
          {user?.email}
        </p>

      </section>


      {/* ================= STATS ================= */}

      <section className="stats-grid">

        <div className="stat-card">

          <span>⏰</span>

          <h3>
            {alarms.length}
          </h3>

          <p>Total Alarms</p>

        </div>


        <div className="stat-card">

          <span>✅</span>

          <h3>
            {
              alarms.filter(
                (alarm) => alarm.is_active
              ).length
            }
          </h3>

          <p>Active Alarms</p>

        </div>


        <div className="stat-card">

          <span>😴</span>

          <h3>
            {
              alarms.reduce(
                (total, alarm) =>
                  total +
                  (alarm.snooze_count || 0),
                0
              )
            }
          </h3>

          <p>Snoozes</p>

        </div>


        <div className="stat-card">

          <span>🏆</span>

          <h3>
            {
              alarms.reduce(
                (total, alarm) =>
                  total +
                  (alarm.completed_count || 0),
                0
              )
            }
          </h3>

          <p>Completed</p>

        </div>

      </section>


      {/* ================= ERROR ================= */}

      {error && (

        <div className="error-box dashboard-error">

          {error}

        </div>

      )}


      {/* ================= ALARM SECTION ================= */}

      <section className="alarms-section">

        <div className="section-header">

          <div>

            <h2>
              My Alarms
            </h2>

            <p>
              Manage your cognitive alarms
            </p>

          </div>


          <button
            className="primary-button add-alarm-button"
            onClick={() =>
              setShowForm(!showForm)
            }
          >
            {showForm
              ? "Close"
              : "+ Create Alarm"}
          </button>

        </div>


        {/* ================= CREATE FORM ================= */}

        {showForm && (

          <form
            className="alarm-form"
            onSubmit={handleCreateAlarm}
          >

            <h3>
              Create New Alarm
            </h3>


            <label>
              Alarm Title
            </label>

            <input
              type="text"
              placeholder="Morning Brain Alarm"
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              required
            />


            <label>
              Description
            </label>

            <input
              type="text"
              placeholder="Start the day with a cognitive challenge"
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
            />


            <label>
              Alarm Time
            </label>

            <input
              type="time"
              value={alarmTime}
              onChange={(e) =>
                setAlarmTime(e.target.value)
              }
              required
            />


            <label>
              Alarm Type
            </label>

            <select
              value={alarmType}
              onChange={(e) =>
                setAlarmType(e.target.value)
              }
            >

              <option value="daily">
                Daily
              </option>

              <option value="weekly">
                Weekly
              </option>

            </select>


            <label>
              Days
            </label>

            <input
              type="text"
              value={days}
              onChange={(e) =>
                setDays(e.target.value)
              }
            />


            <label>
              Difficulty
            </label>

            <select
              value={difficulty}
              onChange={(e) =>
                setDifficulty(e.target.value)
              }
            >

              <option value="easy">
                Easy
              </option>

              <option value="medium">
                Medium
              </option>

              <option value="hard">
                Hard
              </option>

            </select>


            <label>
              Challenge Type
            </label>

            <select
              value={challengeType}
              onChange={(e) =>
                setChallengeType(e.target.value)
              }
            >

              <option value="math">
                Math
              </option>

              <option value="logic">
                Logic
              </option>

              <option value="memory">
                Memory
              </option>

              <option value="riddle">
                Riddle
              </option>

              <option value="word">
                Word
              </option>

            </select>


            <label className="checkbox-label">

              <input
                type="checkbox"
                checked={isSmart}
                onChange={(e) =>
                  setIsSmart(e.target.checked)
                }
              />

              Smart Alarm

            </label>


            <button
              type="submit"
              className="primary-button"
            >
              Create Alarm
            </button>

          </form>

        )}


        {/* ================= ALARM LIST ================= */}

        {loading ? (

          <div className="loading">
            Loading alarms...
          </div>

        ) : alarms.length === 0 ? (

          <div className="empty-state">

            <div>
              ⏰
            </div>

            <h3>
              No alarms yet
            </h3>

            <p>
              Create your first cognitive alarm.
            </p>

          </div>

        ) : (

          <div className="alarm-list">

            {alarms.map((alarm) => (

              <div
                className="alarm-card"
                key={alarm.id}
              >

                <div className="alarm-main">

                  <div className="alarm-icon">
                    🧠
                  </div>


                  <div>

                    <h3>
                      {alarm.title}
                    </h3>

                    <p>
                      {alarm.description}
                    </p>

                    <div className="alarm-details">

                      <span>
                        ⏰ {alarm.alarm_time}
                      </span>

                      <span>
                        🎯 {alarm.difficulty}
                      </span>

                      <span>
                        🧩 {alarm.challenge_type}
                      </span>

                    </div>

                  </div>

                </div>


                <div className="alarm-status">

                  <span
                    className={
                      alarm.is_active
                        ? "active-badge"
                        : "inactive-badge"
                    }
                  >
                    {alarm.is_active
                      ? "Active"
                      : "Inactive"}
                  </span>


                  <div className="alarm-actions">

                    <button
                      className="small-button"
                      onClick={() =>
                        handleSnooze(alarm.id)
                      }
                    >
                      Snooze
                    </button>


                    <button
                      className="small-button"
                      onClick={() =>
                        handleComplete(alarm.id)
                      }
                    >
                      Complete
                    </button>


                    <button
                      className="delete-button"
                      onClick={() =>
                        handleDelete(alarm.id)
                      }
                    >
                      Delete
                    </button>

                  </div>


                  <div className="alarm-counts">

                    Snoozes:
                    {" "}
                    {alarm.snooze_count || 0}

                    {" • "}

                    Completions:
                    {" "}
                    {alarm.completed_count || 0}

                  </div>

                </div>

              </div>

            ))}

          </div>

        )}

      </section>

    </div>

  );
}


export default Dashboard;