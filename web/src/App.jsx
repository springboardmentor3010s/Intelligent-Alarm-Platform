import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Alarms from './pages/AlarmManagement';
import Challenges from './pages/ChallengeGenerator';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Admin from './pages/Admin';

function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'));

  const handleAuth = () => setAuthed(true);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthed(false);
  };

  if (!authed) {
    return (
      <Router>
        <Routes>
          <Route path="*" element={<Auth onAuth={handleAuth} />} />
        </Routes>
      </Router>
    );
  }

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const name = user.full_name || user.email?.split('@')[0] || 'User';

  return (
    <Router>
      <nav className="app-nav">
        <span className="brand">
          <span className="brand-mark">🧠</span> CerebroKognit
        </span>
        <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Home</NavLink>
        <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
        <NavLink to="/alarms" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Alarms</NavLink>
        <NavLink to="/challenges" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Challenges</NavLink>
        <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Reports</NavLink>
        <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Admin</NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Settings</NavLink>
        <div className="nav-spacer" />
        <span className="nav-user">Hi, {name}</span>
        <button onClick={handleLogout} className="nav-logout">Logout</button>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/alarms" element={<Alarms />} />
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
