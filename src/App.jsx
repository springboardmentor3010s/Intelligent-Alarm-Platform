import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Alarms from "./pages/Alarms";
import CognitiveAlarm from "./pages/CognitiveAlarm";
import AdminRoute from "./components/AdminRoute";
import AdminDashboard from "./pages/AdminDashboard";
import CoachRoute from "./components/CoachRoute";
import CoachDashboard from "./pages/CoachDashboard";
import Profile from "./pages/Profile";
import SessionHistory from "./pages/SessionHistory";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import AlarmWatcher from "./components/AlarmWatcher";
import { ThemeProvider } from "./context/ThemeContext";
import "./App.css";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AlarmWatcher />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/alarms" element={<Alarms />} />
          <Route path="/cognitive-alarm" element={<CognitiveAlarm />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/coach"
            element={
              <CoachRoute>
                <CoachDashboard />
              </CoachRoute>
            }
          />
          <Route path="/profile" element={<Profile />} />
          <Route path="/session-history" element={<SessionHistory />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;