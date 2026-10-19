
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Alarms from "./pages/Alarms";
import Habits from "./pages/Habits";
import Challenges from "./pages/Challenges";
import Analytics from "./pages/Analytics";
import Coach from "./pages/Coach";
import Notifications from "./pages/Notifications";

// Separate Wellness Coach Login
import CoachLogin from "./CoachLogin";

import AlarmTrigger from "./components/AlarmTrigger";

function App() {
  return (
    <BrowserRouter>
      {/* GLOBAL COGNIA ALARM */}
      <AlarmTrigger />

      <Routes>
        {/* Starting page */}
        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        {/* User Authentication */}
        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        {/* Separate Wellness Coach Login */}
        <Route
          path="/coach-login"
          element={<CoachLogin />}
        />

        {/* Main COGNIA Pages */}
        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/alarms"
          element={<Alarms />}
        />

        <Route
          path="/habits"
          element={<Habits />}
        />

        <Route
          path="/challenges"
          element={<Challenges />}
        />

        <Route
          path="/analytics"
          element={<Analytics />}
        />

        {/* Existing Coach Page */}
        <Route
          path="/coach"
          element={<Coach />}
        />

        {/* Notifications */}
        <Route
          path="/notifications"
          element={<Notifications />}
        />

        {/* Unknown URL */}
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
