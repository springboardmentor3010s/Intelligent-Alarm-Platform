// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Alarms from './pages/AlarmManagement';
import Challenges from './pages/ChallengeGenerator';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Admin from './pages/Admin';
import Landing from './pages/Landing';
import Sidebar from './components/layout/Sidebar';
import { NAV_SECTIONS, sectionsForRole } from './navSections';
import { MenuIcon, LiveClock } from './components/ui';
import ThemeToggle from './components/auth/ThemeToggle';

function initialsOf(user) {
  const source = user.full_name || user.email || 'User';
  const clean = source.split(/[@\s_]+/).filter(Boolean);
  const chars = clean.length >= 2 ? [clean[0], clean[1]] : [clean[0].slice(0, 2)];
  return chars.map(c => c[0]?.toUpperCase() || '').join('').slice(0, 2);
}

/** Resolve the current route to the matching nav section & page label. */
function resolveBreadcrumb(pathname, sections = NAV_SECTIONS) {
  for (const section of sections) {
    const match = section.links.find(l =>
      l.to === '/' ? pathname === '/' : pathname.startsWith(l.to)
    );
    if (match) {
      return { section: section.label, page: match.label };
    }
  }
  return { section: 'Workspace', page: 'Overview' };
}

/** Google Workspace-style topbar: breadcrumb tag + live clock + theme toggle. */
function Topbar({ onMenuToggle, mobileNavOpen, sections }) {
  const { pathname } = useLocation();
  const crumb = resolveBreadcrumb(pathname, sections);
  return (
    <header className="app-topbar">
      <div className="app-topbar__left">
        <button
          type="button"
          className="nav-menu-toggle"
          onClick={onMenuToggle}
          aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileNavOpen}
        >
          <MenuIcon size={20} />
        </button>
        <span className="breadcrumb-tag">
          <span className="breadcrumb-tag__section">{crumb.section}</span>
          <span className="breadcrumb-tag__slash">/</span>
          <span className="breadcrumb-tag__page">{crumb.page}</span>
        </span>
      </div>
      <div className="app-topbar__right">
        <LiveClock />
        <ThemeToggle />
      </div>
    </header>
  );
}

function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'));
  const [restoring, setRestoring] = useState(() => !!localStorage.getItem('token'));
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('ck-sidebar-collapsed') === '1');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Validate a stored token on startup so an expired/invalid JWT doesn't leave
  // the user stuck on a broken dashboard (every authed call 401s). Fails fast
  // on 401/403; keeps the session on a merely transient network error.
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

  // Close the mobile drawer on Escape.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = e => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  const handleAuth = (data) => {
    if (data?.user) {
      try {
        localStorage.setItem('user', JSON.stringify(data.user));
      } catch {
        /* storage unavailable */
      }
    }
    setAuthed(true);
  };

  const handleLogout = () => {
    setMobileNavOpen(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthed(false);
  };

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('ck-sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  };

  if (restoring) {
    return (
      <div className="session-loading" role="status">
        <span className="spinner" aria-hidden="true" />
        <span>Loading session…</span>
      </div>
    );
  }

  if (!authed) {
    return (
      <Router>
        <Routes>
          <Route path="/auth" element={<Auth onAuth={handleAuth} />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </Router>
    );
  }

  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch (e) {
    user = {};
  }
  const name = user.full_name || user.email?.split('@')[0] || 'User';
  const email = user.email || '';
  const initials = initialsOf(user);
  const sections = sectionsForRole(user.role);
  const isStaff = user.role === 'Administrator' || user.role === 'Wellness Coach';

  const shellClass = [
    'app-shell',
    collapsed ? 'app-shell--collapsed' : '',
    mobileNavOpen ? 'app-shell--drawer-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <Router>
      <div className={shellClass}>
        <Sidebar
          name={name}
          email={email}
          initials={initials}
          collapsed={collapsed}
          sections={sections}
          onToggleCollapsed={toggleCollapsed}
          onNavigate={() => setMobileNavOpen(false)}
          onLogout={handleLogout}
        />

        {mobileNavOpen && (
          <button
            type="button"
            className="sidebar-overlay"
            aria-label="Close navigation menu"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        <div className="app-main">
          <Topbar
            onMenuToggle={() => setMobileNavOpen(v => !v)}
            mobileNavOpen={mobileNavOpen}
            sections={sections}
          />

          <main className="app-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/alarms" element={<Alarms />} />
              <Route path="/challenges" element={<Challenges />} />
              <Route path="/reports" element={<Reports />} />
              <Route
                path="/admin"
                element={isStaff ? <Admin /> : <Navigate to="/" replace />}
              />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;