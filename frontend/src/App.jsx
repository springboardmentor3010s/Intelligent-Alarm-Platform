import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import "./App.css";

// Auth Pages
import Login from "./pages/Login";
import Register from "./pages/Register";

// User Pages
import UserDashboard from "./pages/user/Dashboard";
import MyHabits from "./pages/user/MyHabits";
import AddHabit from "./pages/user/AddHabit";
import Categories from "./pages/user/Categories";
import Reminders from "./pages/user/Reminders";
import Profile from "./pages/user/Profile";
import Settings from "./pages/user/Settings";
import Coach from "./pages/user/Coach";
import WakeUpChallenge from "./pages/user/WakeUpChallenge";
import ChallengeHistory from "./pages/user/ChallengeHistory";
import CognitiveAnalytics from "./pages/user/CognitiveAnalytics";
import Reports from "./pages/user/Reports";
// Coach Pages
import CoachDashboard from "./pages/coach/CoachDashboard";
import CoachUsers from "./pages/coach/CoachUsers";
import CoachPerformance from "./pages/coach/CoachPerformance";
import CoachVerification from "./pages/coach/CoachVerification";
import CoachAnalytics from "./pages/coach/CoachAnalytics";
import CoachReports from "./pages/coach/CoachReports";
import CoachMessages from "./pages/coach/CoachMessages";
// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import AdminReports from "./pages/admin/AdminReports";
import PlatformAnalytics from "./pages/admin/PlatformAnalytics";
import ChallengeActivity from "./pages/admin/ChallengeActivity";
import AdminAlarms from "./pages/admin/AdminAlarms";
import AdminVerification from "./pages/admin/AdminVerification";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import Placeholder from "./pages/Placeholder";

import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./context/ThemeContext";

// =====================================================
// HELPERS
// =====================================================
function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

// =====================================================
// PROTECTED ROUTE
// =====================================================
function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("access_token");
  const user = getStoredUser();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === "admin") return <Navigate to="/admin-dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// =====================================================
// ROUTER APP
// =====================================================
function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* USER ROUTES */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={["user"]}><UserDashboard /></ProtectedRoute>} />
        <Route path="/habits" element={<ProtectedRoute allowedRoles={["user"]}><MyHabits /></ProtectedRoute>} />
        <Route path="/add-habit" element={<ProtectedRoute allowedRoles={["user"]}><AddHabit /></ProtectedRoute>} />
        <Route path="/categories" element={<ProtectedRoute allowedRoles={["user"]}><Categories /></ProtectedRoute>} />
        <Route path="/reminders" element={<ProtectedRoute allowedRoles={["user"]}><Reminders /></ProtectedRoute>} />
        <Route path="/alarms" element={<Navigate to="/reminders" replace />} />
        <Route path="/coach" element={<Navigate to="/coach-dashboard" replace />} />
        <Route path="/coach-dashboard" element={<ProtectedRoute allowedRoles={["wellness_coach", "admin"]}><CoachDashboard /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute allowedRoles={["user", "admin", "wellness_coach"]}><Profile /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute allowedRoles={["user", "admin", "wellness_coach"]}><Settings /></ProtectedRoute>} />
        <Route path="/wake-up-challenge" element={<ProtectedRoute allowedRoles={["user"]}><WakeUpChallenge /></ProtectedRoute>} />
        <Route path="/challenge-history" element={<ProtectedRoute allowedRoles={["user"]}><ChallengeHistory /></ProtectedRoute>} />
        <Route path="/cognitive-analytics" element={<ProtectedRoute allowedRoles={["user"]}><CognitiveAnalytics /></ProtectedRoute>} />
        <Route path="/coach-guidance" element={<ProtectedRoute allowedRoles={["user"]}><Coach /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute allowedRoles={["user"]}><Reports /></ProtectedRoute>} />

        {/* ADMIN ROUTES */}
        <Route path="/admin-dashboard" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["admin"]}><UserManagement /></ProtectedRoute>} />
        <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={["admin"]}><AdminAnnouncements /></ProtectedRoute>} />
        <Route path="/admin/alarms" element={<ProtectedRoute allowedRoles={["admin"]}><AdminAlarms /></ProtectedRoute>} />
        <Route path="/admin/activity" element={<ProtectedRoute allowedRoles={["admin"]}><ChallengeActivity /></ProtectedRoute>} />
        <Route path="/admin/verification" element={<ProtectedRoute allowedRoles={["admin"]}><AdminVerification /></ProtectedRoute>} />
        <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={["admin"]}><PlatformAnalytics /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={["admin"]}><AdminReports /></ProtectedRoute>} />
        <Route path="/admin-reports" element={<Navigate to="/admin/reports" replace />} />

        {/* COACH ROUTES */}
        <Route path="/coach/messages" element={<ProtectedRoute allowedRoles={["wellness_coach", "admin"]}><CoachMessages /></ProtectedRoute>} />
        <Route path="/coach/users" element={<ProtectedRoute allowedRoles={["wellness_coach", "admin"]}><CoachUsers /></ProtectedRoute>} />
        <Route path="/coach/performance" element={<ProtectedRoute allowedRoles={["wellness_coach", "admin"]}><CoachPerformance /></ProtectedRoute>} />
        <Route path="/coach/verification" element={<ProtectedRoute allowedRoles={["wellness_coach", "admin"]}><CoachVerification /></ProtectedRoute>} />
        <Route path="/coach/analytics" element={<ProtectedRoute allowedRoles={["wellness_coach", "admin"]}><CoachAnalytics /></ProtectedRoute>} />
        <Route path="/coach/reports" element={<ProtectedRoute allowedRoles={["wellness_coach", "admin"]}><CoachReports /></ProtectedRoute>} />
        <Route path="/coach-reports" element={<Navigate to="/coach/reports" replace />} />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
