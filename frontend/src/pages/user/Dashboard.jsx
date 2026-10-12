import React, { useState } from "react";
import MyAlarms from "./MyAlarms";
import Challenge from "./Challenge";
import Progress from "./Progress";
import Rewards from "./Rewards";
import Profile from "./Profile";
import Settings from "./Settings";
import { getTimeOfDayGreeting } from "../../utils/timeUtils";

function Dashboard({ user, onLogout }) {
  const [activePage, setActivePage] = useState("home");
  const timeMeta = getTimeOfDayGreeting();

  const renderPage = () => {
    switch (activePage) {
      case "alarms":
        return <MyAlarms user={user} />;

      case "challenge":
        return <Challenge user={user} />;

      case "progress":
        return <Progress user={user} />;

      case "rewards":
        return <Rewards user={user} />;

      case "profile":
        return <Profile user={user} />;

      case "settings":
        return <Settings user={user} />;

      default:
        return (
          <div className="user-home">

            <div className="mobile-header">
              <span className="menu-icon">☰</span>

              <strong>COGNITIVE WAKE-UP</strong>

              <span className="notification">🔔</span>
            </div>

            <div className="welcome-section">
              <h1>
                {timeMeta.greeting}, {user?.name || "User"}! {timeMeta.icon}
              </h1>

              <p>{timeMeta.subtitle}</p>
            </div>

            <div
              className="next-alarm-card"
              onClick={() => setActivePage("alarms")}
            >
              <div className="alarm-icon">⏰</div>

              <div>
                <small>Next Alarm</small>
                <h2>6:00 AM</h2>
                <p>Tomorrow</p>
              </div>

              <span className="arrow">›</span>
            </div>

            <div className="stats-row">

              <div className="stat-card">
                <small>Streak</small>
                <div className="stat-icon">🔥</div>
                <strong>7</strong>
                <span>Streak</span>
              </div>

              <div className="stat-card">
                <small>Habit Score</small>

                <div className="circle-score">
                  85%
                </div>
              </div>

              <div className="stat-card">
                <small>Challenge Score</small>

                <div className="stat-icon">
                  🏆
                </div>

                <strong>92%</strong>
              </div>

            </div>

            <button
              className="start-challenge-btn"
              onClick={() => setActivePage("challenge")}
            >
              START CHALLENGE
              <span>→</span>
            </button>

            <div className="progress-card">

              <div className="progress-title">
                <strong>Today's Progress</strong>
                <strong>85%</strong>
              </div>

              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: "85%" }}
                />
              </div>

            </div>

          </div>
        );
    }
  };

  return (
    <div className="mobile-app">

      <main className="page-content">
        {renderPage()}
      </main>

      <nav className="bottom-nav">

        <button
          className={activePage === "home" ? "active" : ""}
          onClick={() => setActivePage("home")}
        >
          <span>⌂</span>
          <small>Home</small>
        </button>

        <button
          className={activePage === "progress" ? "active" : ""}
          onClick={() => setActivePage("progress")}
        >
          <span>📊</span>
          <small>Progress</small>
        </button>

        <button
          className={activePage === "rewards" ? "active" : ""}
          onClick={() => setActivePage("rewards")}
        >
          <span>🏆</span>
          <small>Rewards</small>
        </button>

        <button
          className={activePage === "profile" ? "active" : ""}
          onClick={() => setActivePage("profile")}
        >
          <span>♙</span>
          <small>Profile</small>
        </button>

      </nav>

    </div>
  );
}

export default Dashboard;