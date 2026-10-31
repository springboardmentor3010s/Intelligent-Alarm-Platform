// File: frontend/src/App.jsx

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AuthProvider, homePathFor, useAuth } from "./auth";

import Layout from "./components/Layout";
import AlarmScheduler from "./components/AlarmScheduler";

import Dashboard from "./pages/Dashboard";
import Alarms from "./pages/Alarms";
import Challenges from "./pages/Challenges";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import WakeUpVerification from "./pages/WakeUpVerification";
import Login from "./pages/Login";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import CoachDashboard from "./pages/CoachDashboard";
import AdminDashboard from "./pages/AdminDashboard";

// Runs the alarm scheduler once, persistently across page changes, and only
// for signed-in members. Mounting it here (instead of inside Layout) keeps a
// single instance alive during navigation so a ringing alarm is not torn down
// when the member moves between pages.
function MemberAlarmScheduler() {
  const { user } = useAuth();
  return user?.role === "user" ? <AlarmScheduler /> : null;
}

// Shows a page only to signed-in people with an allowed role.
function Protected({ roles, children }) {
  const { user, checking } = useAuth();

  if (checking) {
    return <div className="auth-loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  return <Layout>{children}</Layout>;
}

// Redirects users to the correct home page.
function Home() {
  const { user, checking } = useAuth();

  if (checking) {
    return <div className="auth-loading">Loading...</div>;
  }

  return (
    <Navigate
      to={user ? homePathFor(user) : "/login"}
      replace
    />
  );
}

const MEMBER = ["user"];

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Keep a single alarm scheduler running across app pages. */}
        <MemberAlarmScheduler />

        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/login" element={<Login />} />

          <Route
            path="/dashboard"
            element={
              <Protected roles={MEMBER}>
                <Dashboard />
              </Protected>
            }
          />

          <Route
            path="/alarms"
            element={
              <Protected roles={MEMBER}>
                <Alarms />
              </Protected>
            }
          />

          <Route
            path="/challenges"
            element={
              <Protected roles={MEMBER}>
                <Challenges />
              </Protected>
            }
          />

          <Route
            path="/analytics"
            element={
              <Protected roles={MEMBER}>
                <Analytics />
              </Protected>
            }
          />

          <Route
            path="/reports"
            element={
              <Protected roles={MEMBER}>
                <Reports />
              </Protected>
            }
          />

          <Route
            path="/wake-up-verification"
            element={
              <Protected roles={MEMBER}>
                <WakeUpVerification />
              </Protected>
            }
          />

          <Route
            path="/notifications"
            element={
              <Protected>
                <Notifications />
              </Protected>
            }
          />

          <Route
            path="/settings"
            element={
              <Protected>
                <Settings />
              </Protected>
            }
          />

          <Route
            path="/coach"
            element={
              <Protected roles={["coach"]}>
                <CoachDashboard />
              </Protected>
            }
          />

          <Route
            path="/admin"
            element={
              <Protected roles={["admin"]}>
                <AdminDashboard />
              </Protected>
            }
          />

          <Route path="*" element={<Home />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;