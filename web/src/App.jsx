import React, { Fragment, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Alarms from './pages/AlarmManagement';
import Challenges from './pages/ChallengeGenerator';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Admin from './pages/Admin';

// §21 navigation hierarchy. Every destination reuses an existing page; items
// without a dedicated page (Habits Score/Tracking, Sleep, Recommendations,
// Challenge Performance) are surfaced by the page each link points to, as
// described in the `title` tooltip.
const NAV_SECTIONS = [
  {
    label: 'Track',
    links: [
      { to: '/', label: 'Home', title: "Today's progress" },
      { to: '/dashboard', label: 'Analytics', title: 'Habits (score · tracking) · Sleep · Analytics · Recommendations' },
    ],
  },
  {
    label: 'Plan',
    links: [
      { to: '/alarms', label: 'Alarms', title: 'Active · History · Create' },
      { to: '/challenges', label: 'Challenges', title: 'Generator · History · Performance' },
    ],
  },
  {
    label: 'Account',
    links: [
      { to: '/reports', label: 'Reports', title: 'Habit · Wake-up · Challenge exports' },
      { to: '/settings', label: 'Profile', title: 'Profile & preferences' },
      { to: '/admin', label: 'Admin', title: 'Users · Reports · Configuration (staff)' },
    ],
  },
];

function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'));
  const [restoring, setRestoring] = useState(() => !!localStorage.getItem('token'));

  // Validate a stored token on startup so an expired/invalid JWT doesn't leave
  // the user stuck on a broken dashboard (every authed call 401s -> "Could not
  // load"). Mirrors the mobile useAuth fix. Fails fast on 401/403; keeps the
  // session (with a full list refresh) on a merely transient network error.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setRestoring(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setAuthed(false);
        } else {
          const profile = await res.json();
          localStorage.setItem('user', JSON.stringify(profile.user || profile));
          setAuthed(true);
        }
      } catch {
        if (!cancelled) setAuthed(true);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleAuth = () => setAuthed(true);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthed(false);
  };

  if (restoring) return <div className="page">Loading session…</div>;

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
        {NAV_SECTIONS.map(section => (
          <Fragment key={section.label}>
            <span className="nav-label">{section.label}</span>
            {section.links.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                title={link.title}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
          </Fragment>
        ))}
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