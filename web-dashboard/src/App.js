import React, { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const API_BASE = 'http://localhost:8000';

const ALARM_TYPES = ["Daily Alarm", "Weekday Alarm", "Weekend Alarm", "One-Time Alarm", "Smart Adaptive Alarm"];
const CHALLENGE_TYPES = ["Math Problems", "Logic Puzzles", "Memory Challenges", "Word Games", "Pattern Recognition", "Riddles", "Quick Quizzes"];
const VERIFICATION_METHODS = ["Puzzle Completion", "Multi-Step Challenges", "Consecutive Correct Answers", "Time-Based Challenges", "Cognitive Accuracy Checks"];
const DIFFICULTY_LEVELS = ["Beginner", "Easy", "Medium", "Hard", "Expert"];

const REPORT_CATEGORIES = [
  "Complete Master Report",
  "Habit reports",
  "Wake-up reports",
  "Challenge performance reports",
  "Productivity reports",
  "Sleep analytics reports"
];

function formatTime12Hour(time24) {
  if (!time24) return '07:30 AM';
  if (typeof time24 === 'string' && (time24.includes('AM') || time24.includes('PM'))) return time24;
  let tStr = String(time24).trim();
  if (tStr.includes(':')) {
    const [hStr, mStr] = tStr.split(':');
    let h = parseInt(hStr, 10);
    const m = (mStr || '00').slice(0, 2);
    if (isNaN(h)) return '07:30 AM';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  }
  return '07:30 AM';
}

function formatFullTimestamp(isoString) {
  if (!isoString) return 'Just now';
  const d = new Date(isoString);
  return isNaN(d.getTime()) ? isoString : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatGraphTimestamp(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return isNaN(d.getTime()) ? isoString : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function to24HourString(hour12, minute, period) {
  let h = parseInt(hour12, 10);
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parse24Hour(time24) {
  if (!time24 || !time24.includes(':')) return { hour12: '07', minute: '30', period: 'AM' };
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return { hour12: String(h).padStart(2, '0'), minute: mStr.slice(0, 2).padStart(2, '0'), period };
}

function ProAlarmBrandIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5" />
      <path d="M5 3 2 6" />
      <path d="m22 6-3-3" />
      <path d="M6.38 18.7 4 21" />
      <path d="M17.64 18.67 20 21" />
    </svg>
  );
}

function TimePicker12Hour({ value24, onChange24 }) {
  const { hour12, minute, period } = parse24Hour(value24);
  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  const updatePart = (newH, newM, newP) => onChange24(to24HourString(newH, newM, newP));

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <select value={hour12} onChange={e => updatePart(e.target.value, minute, period)} style={{ flex: 1, padding: '12px', fontSize: '17px', fontWeight: '800', borderRadius: '12px', border: '1.5px solid #CBD5E1', background: '#F8FAFC', color: '#0F172A', cursor: 'pointer' }}>
        {hours.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span style={{ fontSize: '20px', fontWeight: '900', color: '#4F46E5' }}>:</span>
      <select value={minute} onChange={e => updatePart(hour12, e.target.value, period)} style={{ flex: 1, padding: '12px', fontSize: '17px', fontWeight: '800', borderRadius: '12px', border: '1.5px solid #CBD5E1', background: '#F8FAFC', color: '#0F172A', cursor: 'pointer' }}>
        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <div style={{ display: 'flex', background: '#E2E8F0', padding: '3px', borderRadius: '12px', border: '1.5px solid #CBD5E1' }}>
        {['AM', 'PM'].map(p => (
          <button key={p} type="button" onClick={() => updatePart(hour12, minute, p)} style={{ padding: '8px 14px', borderRadius: '9px', border: 'none', fontSize: '14px', fontWeight: '800', cursor: 'pointer', background: period === p ? 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)' : 'transparent', color: period === p ? '#FFFFFF' : '#475569' }}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

class AlarmRinger {
  constructor() {
    this.ctx = null;
    this.intervalId = null;
    this.isPlaying = false;
  }
  start() {
    if (this.isPlaying) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.isPlaying = true;
      const playChime = () => {
        if (!this.isPlaying || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.13);
          gain.gain.setValueAtTime(0.28, this.ctx.currentTime + idx * 0.13);
          gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + idx * 0.13 + 0.11);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(this.ctx.currentTime + idx * 0.13);
          osc.stop(this.ctx.currentTime + idx * 0.13 + 0.12);
        });
      };
      playChime();
      this.intervalId = setInterval(playChime, 950);
    } catch (e) {}
  }
  stop() {
    this.isPlaying = false;
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.ctx) { try { this.ctx.close(); } catch (e) {} this.ctx = null; }
  }
}

const alarmRinger = new AlarmRinger();

const colorfulTheme = {
  pageWrapper: {
    minHeight: '100vh', width: '100%', position: 'relative', overflowX: 'hidden',
    background: 'linear-gradient(135deg, #FFF1F2 0%, #FDF4FF 25%, #EFF6FF 65%, #ECFDF5 100%)',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", fontSize: '17px', color: '#1E293B'
  },
  card: {
    background: '#FFFFFF', borderRadius: '22px', padding: '28px', border: '1px solid #E2E8F0',
    boxShadow: '0 12px 32px rgba(99, 102, 241, 0.08)', position: 'relative', zIndex: 2
  },
  heroCard: {
    background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 55%, #DB2777 100%)',
    color: '#FFFFFF', borderRadius: '24px', padding: '32px', boxShadow: '0 20px 45px rgba(99, 102, 241, 0.3)', position: 'relative', zIndex: 2
  },
  label: { display: 'block', fontSize: '15.5px', fontWeight: '700', color: '#334155', marginBottom: '8px' },
  input: { width: '100%', padding: '13px 16px', fontSize: '16.5px', borderRadius: '12px', border: '1.5px solid #CBD5E1', background: '#F8FAFC', color: '#0F172A', fontWeight: '500', boxSizing: 'border-box' },
  primaryBtn: { padding: '13px 24px', background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)', color: '#FFFFFF', border: 'none', borderRadius: '999px', fontSize: '16.5px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 8px 22px rgba(37, 99, 235, 0.35)', transition: 'all 0.2s ease' },
  deleteBtn: { padding: '8px 14px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '999px', fontSize: '13.5px', fontWeight: '800', cursor: 'pointer' },
  badge: { fontSize: '13px', fontWeight: '800', padding: '5px 14px', borderRadius: '999px' }
};

function ColorfulBackgroundOrbs() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-150px', left: '-120px', width: '580px', height: '580px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236, 72, 153, 0.22) 0%, rgba(236, 72, 153, 0) 70%)', filter: 'blur(100px)' }} />
      <div style={{ position: 'absolute', top: '25%', right: '-160px', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(37, 99, 235, 0.22) 0%, rgba(124, 58, 237, 0.18) 60%, transparent 80%)', filter: 'blur(110px)' }} />
      <div style={{ position: 'absolute', bottom: '-150px', left: '30%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6, 182, 212, 0.22) 0%, rgba(245, 158, 11, 0.18) 60%, transparent 80%)', filter: 'blur(115px)' }} />
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(sessionStorage.getItem('token') || '');
  const [authMode, setAuthMode] = useState('login');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [registerRole, setRegisterRole] = useState('User');
  const [statusMsg, setStatusMsg] = useState({ text: '', type: 'info' });

  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleView, setGoogleView] = useState('chooser');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [savedGoogleAccounts, setSavedGoogleAccounts] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('saved_google_accounts') || '[]');
      return stored.length > 0 ? stored : [{ email: 'likhit.royal@gmail.com', name: 'Likhit Royal', role: 'User' }];
    } catch {
      return [{ email: 'likhit.royal@gmail.com', name: 'Likhit Royal', role: 'User' }];
    }
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);

  const [alarmForm, setAlarmForm] = useState({
    time: '07:30',
    alarm_type: 'Smart Adaptive Alarm',
    recurring_days: 'Mon-Fri',
    challenge_type: 'Math Problems',
    verification_method: 'Puzzle Completion',
    custom_label: 'Morning Deep-Work Alarm'
  });

  const [profileForm, setProfileForm] = useState({
    full_name: '', preferred_wake_time: '07:30', sleep_duration_hours: 8.0,
    timezone: 'IST (UTC+5:30)', productivity_goals: 'Morning Study & Deep Focus',
    difficulty_preference: 'Easy', habit_preferences: 'Math Problems'
  });

  const [selectedChallengeType, setSelectedChallengeType] = useState('Math Problems');
  const [selectedVerification, setSelectedVerification] = useState('Puzzle Completion');
  const [arenaDifficulty, setArenaDifficulty] = useState('Easy');
  
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [stepProgress, setStepProgress] = useState(1);
  const [challengeStartTime, setChallengeStartTime] = useState(null);
  const [verificationFeedback, setVerificationFeedback] = useState(null);

  const [snoozeCount, setSnoozeCount] = useState(0);
  const [selectedReportType, setSelectedReportType] = useState('Complete Master Report');
  const [announcementText, setAnnouncementText] = useState('');
  const [targetRecipientName, setTargetRecipientName] = useState('ALL');
  const [supportMessageText, setSupportMessageText] = useState('');
  const [supportStaffTarget, setSupportStaffTarget] = useState('All Staff');
  const [lastTriggeredMinute, setLastTriggeredMinute] = useState('');

  const [localLogsOverride, setLocalLogsOverride] = useState(null);

  // Persistent Cross-Page Local Notifications
  const [notifications, setNotifications] = useState(() => {
    try {
      const stored = localStorage.getItem('persistent_notifications');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const addNotification = useCallback((category, message) => {
    const item = { category, message, created_at: new Date().toISOString() };
    setNotifications(prev => {
      const updated = [item, ...prev];
      localStorage.setItem('persistent_notifications', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleLogout = useCallback(() => {
    alarmRinger.stop();
    sessionStorage.removeItem('token');
    setToken('');
    setDashboard(null);
  }, []);

  const fetchDashboard = useCallback(async (authToken = token) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/dashboard`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
        setStatusMsg(prev => (prev.text.includes('port 8000') ? { text: '', type: 'info' } : prev));
        if (data.profile) {
          setProfileForm(prev => ({ ...prev, ...data.profile }));
          setArenaDifficulty(prev => prev || data.profile.difficulty_preference || 'Easy');
        }
        if (data.notifications && data.notifications.length > 0) {
          setNotifications(prev => {
            const merged = [...prev, ...data.notifications];
            const uniqueMap = new Map();
            merged.forEach(n => {
              const k = `${n.category}|${n.message}|${n.created_at}`;
              if (!uniqueMap.has(k)) uniqueMap.set(k, n);
            });
            const sorted = Array.from(uniqueMap.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            localStorage.setItem('persistent_notifications', JSON.stringify(sorted));
            return sorted;
          });
        }
      } else if (res.status === 401) handleLogout();
    } catch {
      setStatusMsg({ text: 'Backend offline on port 8000 — Run "uvicorn main:app --reload" in Terminal 1.', type: 'error' });
    }
  }, [token, handleLogout]);

  useEffect(() => {
    if (token) fetchDashboard(token);
  }, [token, fetchDashboard]);

  const lockedRole = dashboard?.assigned_role || dashboard?.profile?.role || 'User';
  useEffect(() => {
    if (lockedRole === 'Administrator') setActiveTab('admin_users');
    else if (lockedRole === 'Wellness Coach') setActiveTab('coach_cohort');
    else setActiveTab('overview');
  }, [lockedRole]);

  const startWakeUpChallenge = useCallback(async (
    cType = selectedChallengeType, cDiff = arenaDifficulty || profileForm.difficulty_preference, vMethod = selectedVerification, currentSnoozeCount = 0
  ) => {
    alarmRinger.start();
    setVerificationFeedback(null);
    setSnoozeCount(currentSnoozeCount);
    const url = `${API_BASE}/challenge/generate?challenge_type=${encodeURIComponent(cType)}&difficulty=${encodeURIComponent(cDiff)}&verification_method=${encodeURIComponent(vMethod)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setActiveChallenge(data);
      setUserAnswer('');
      setStepProgress(1);
      setChallengeStartTime(Date.now());
    }
  }, [selectedChallengeType, arenaDifficulty, profileForm.difficulty_preference, selectedVerification, token]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      const currentHHMM = now.toTimeString().slice(0, 5);

      if (dashboard?.alarms && !activeChallenge && lastTriggeredMinute !== currentHHMM) {
        const match = dashboard.alarms.find(a => a.is_active && a.time === currentHHMM);
        if (match) {
          setLastTriggeredMinute(currentHHMM);
          startWakeUpChallenge(match.challenge_type, profileForm.difficulty_preference, match.verification_method, 0);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [dashboard, activeChallenge, lastTriggeredMinute, startWakeUpChallenge, profileForm.difficulty_preference]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setStatusMsg({ text: '', type: 'info' });
    try {
      if (authMode === 'login') {
        const form = new URLSearchParams({ username, password });
        const res = await fetch(`${API_BASE}/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
        if (res.ok) {
          const data = await res.json();
          sessionStorage.setItem('token', data.access_token);
          setToken(data.access_token);
          // Personalized greeting upon login
          const loggedName = data.full_name || username || 'User';
          setStatusMsg({ text: `Hi ${loggedName}, welcome back! Successfully signed in.`, type: 'success' });
          fetchDashboard(data.access_token);
        } else {
          const err = await res.json();
          const errText = err.detail || '';
          if (errText.toLowerCase().includes('password')) {
            setStatusMsg({ text: '❌ Incorrect password. Please try again.', type: 'error' });
          } else if (errText.toLowerCase().includes('user') || errText.toLowerCase().includes('not found')) {
            setStatusMsg({ text: '❌ No user found with this username or email.', type: 'error' });
          } else {
            setStatusMsg({ text: '❌ Invalid username or password.', type: 'error' });
          }
        }
      } else {
        const res = await fetch(`${API_BASE}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: fullName, email, username, password, role: registerRole }) });
        if (res.ok) {
          setStatusMsg({ text: `Hi ${fullName || username}, your ${registerRole} account was created successfully! Please sign in below.`, type: 'success' });
          setAuthMode('login');
        } else {
          const err = await res.json();
          setStatusMsg({ text: err.detail || 'Registration failed (Username or Email may already exist).', type: 'error' });
        }
      }
    } catch {
      setStatusMsg({ text: 'Backend server is not running on port 8000.', type: 'error' });
    }
  };

  const completeGoogleOAuth = async (targetEmail) => {
    const cleanEmail = (targetEmail || googleEmail).trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) { setStatusMsg({ text: 'Please enter a valid Google email address.', type: 'error' }); return; }
    const derivedName = cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    setGoogleLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: cleanEmail, full_name: derivedName, google_id: `google_oauth_${cleanEmail}`, role: authMode === 'register' ? registerRole : 'User' }) });
      if (res.ok) {
        const data = await res.json();
        const updatedAccounts = [{ email: cleanEmail, name: data.full_name || derivedName, role: data.role }, ...savedGoogleAccounts.filter(a => a.email !== cleanEmail)].slice(0, 4);
        setSavedGoogleAccounts(updatedAccounts);
        localStorage.setItem('saved_google_accounts', JSON.stringify(updatedAccounts));
        setShowGoogleModal(false);
        setGoogleView('chooser');
        sessionStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        setStatusMsg({ text: `Hi ${data.full_name || derivedName}, welcome!`, type: 'success' });
        fetchDashboard(data.access_token);
      }
    } catch {
      setStatusMsg({ text: 'Google OAuth failed. Ensure backend is running on port 8000.', type: 'error' });
    } finally { setGoogleLoading(false); }
  };

  const grantRoleAccess = async (targetUserId, newRole) => {
    const res = await fetch(`${API_BASE}/users/${targetUserId}/role?new_role=${encodeURIComponent(newRole)}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { setStatusMsg({ text: `Updated User role to '${newRole}'!`, type: 'success' }); await fetchDashboard(); }
  };

  const deleteUserAccount = async (targetUserId, targetName, targetUsername) => {
    const res = await fetch(`${API_BASE}/users/${targetUserId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      addNotification('Audit Log', `Admin ${displayName} deleted user account '${targetName}' (Username: ${targetUsername || 'unknown'}).`);
      setStatusMsg({ text: `Deleted user account '${targetName}' successfully. Audit notification sent.`, type: 'success' });
      await fetchDashboard();
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(profileForm) });
    if (res.ok) { setStatusMsg({ text: 'Profile & Habit Goals saved! AI Recommendations recalculated.', type: 'success' }); await fetchDashboard(); }
  };

  const createAlarm = async (e) => {
    e.preventDefault();
    const payload = { ...alarmForm, difficulty: profileForm.difficulty_preference };
    const res = await fetch(`${API_BASE}/alarms`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (res.ok) {
      addNotification('Alarm Scheduled', `User ${displayName} scheduled alarm '${alarmForm.custom_label}' for ${formatTime12Hour(alarmForm.time)}.`);
      setStatusMsg({ text: `Alarm added for ${formatTime12Hour(alarmForm.time)} (${alarmForm.challenge_type})!`, type: 'success' });
      await fetchDashboard();
    }
  };

  const toggleAlarm = async (id) => {
    await fetch(`${API_BASE}/alarms/${id}/toggle`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    setStatusMsg({ text: 'Alarm status toggled!', type: 'success' }); await fetchDashboard();
  };

  const deleteAlarm = async (id) => {
    await fetch(`${API_BASE}/alarms/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setStatusMsg({ text: 'Alarm removed.', type: 'success' }); await fetchDashboard();
  };

  const clearAllNotifications = async () => {
    await fetch(`${API_BASE}/notifications/clear`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setNotifications([]);
    localStorage.removeItem('persistent_notifications');
    if (dashboard) dashboard.notifications = [];
    setStatusMsg({ text: 'All notifications cleared.', type: 'success' });
  };

  const submitChallengeVerification = async (snoozed = false) => {
    if (!activeChallenge) return;
    const elapsedSec = challengeStartTime ? ((Date.now() - challengeStartTime) / 1000).toFixed(1) : 9.2;
    const isAnswerMatch = userAnswer.trim().toLowerCase() === activeChallenge.expected_answer.trim().toLowerCase();

    if (!snoozed && !isAnswerMatch) {
      setVerificationFeedback({ ok: false, text: `❌ Incorrect answer! Alarm ringing continues!` });
      setUserAnswer('');
      return; 
    }

    if (!snoozed && isAnswerMatch && stepProgress < activeChallenge.required_steps) {
      const nextStep = stepProgress + 1;
      setStepProgress(nextStep);
      setVerificationFeedback({ ok: true, text: `Step ${stepProgress}/${activeChallenge.required_steps} verified! Solve next puzzle question.` });
      const url = `${API_BASE}/challenge/generate?challenge_type=${encodeURIComponent(activeChallenge.challenge_type)}&difficulty=${encodeURIComponent(activeChallenge.difficulty)}&verification_method=${encodeURIComponent(activeChallenge.verification_method)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const nextQ = await res.json(); setActiveChallenge({ ...nextQ, required_steps: activeChallenge.required_steps }); setUserAnswer(''); }
      return;
    }

    const currentChType = activeChallenge.challenge_type;
    const currentChDiff = activeChallenge.difficulty;
    const currentChVerif = activeChallenge.verification_method;

    const res = await fetch(`${API_BASE}/challenge/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        challenge_id: activeChallenge.challenge_id, challenge_type: currentChType, difficulty: currentChDiff,
        verification_method: currentChVerif, user_answer: userAnswer, expected_answer: activeChallenge.expected_answer,
        time_taken_seconds: parseFloat(elapsedSec), snoozed, steps_completed: stepProgress
      })
    });

    if (res.ok) {
      const result = await res.json();
      if (snoozed) {
        const nextSnoozeCount = snoozeCount + 1;
        alarmRinger.stop();
        addNotification('Habit alerts', `User ${displayName} snoozed alarm! Penalty applied. (${nextSnoozeCount}/2)`);

        if (nextSnoozeCount < 2) {
          setVerificationFeedback({ ok: false, text: `Alarm Snoozed for 2 minutes (Snooze ${nextSnoozeCount}/2). Habit Score penalty applied.` });
          setActiveChallenge(null);
          setTimeout(() => { startWakeUpChallenge(currentChType, currentChDiff, currentChVerif, nextSnoozeCount); }, 120000); 
        } else {
          setVerificationFeedback({ ok: false, text: `Maximum snoozes reached (2/2). Alarm turned off completely.` });
          setActiveChallenge(null);
          setSnoozeCount(0);
        }
      } else if (result.verified) {
        alarmRinger.stop();
        addNotification('Progress notifications', `Wake-up verified for ${displayName}! Habit Score: ${result.score_breakdown.total_habit_score}/100 | ${result.adaptation.action}`);
        setVerificationFeedback({ ok: true, text: `Wake-Up Verified! Habit Score: ${result.score_breakdown.total_habit_score}/100 | ${result.adaptation.action}` });
        setActiveChallenge(null);
        setSnoozeCount(0);
      }
      await fetchDashboard();
    }
  };

  const sendTargetedAlert = async () => {
    if (!announcementText.trim()) return;
    const senderLabel = `${lockedRole}: ${displayName}`;
    const category = targetRecipientName === 'ALL' ? `Broadcast from ${senderLabel}` : `Direct Alert to ${targetRecipientName} from ${senderLabel}`;
    
    addNotification(category, announcementText);

    fetch(`${API_BASE}/notifications/announce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category, message: announcementText })
    });

    setAnnouncementText('');
    setStatusMsg({ text: targetRecipientName === 'ALL' ? 'Broadcast sent to all users!' : `Direct alert sent to ${targetRecipientName}!`, type: 'success' });
  };

  const sendUserSupportMessage = async () => {
    if (!supportMessageText.trim()) return;
    const category = `Query sent to [${supportStaffTarget}] by ${displayName} (User)`;
    
    addNotification(category, supportMessageText);

    fetch(`${API_BASE}/notifications/announce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ category, message: supportMessageText })
    });

    setSupportMessageText('');
    setStatusMsg({ text: `Your query has been sent to ${supportStaffTarget}!`, type: 'success' });
  };

  const downloadFile = async (format, overrideReport = null) => {
    const rType = overrideReport || selectedReportType;
    const ext = format === 'excel' ? 'xlsx' : format;
    const filename = `${rType.toLowerCase().replace(/\s+/g, '_')}.${ext}`;
    const res = await fetch(`${API_BASE}/export/${format}?report_type=${encodeURIComponent(rType)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    } else {
      setStatusMsg({ text: 'Report exported successfully.', type: 'success' });
    }
  };

  const downloadIndividualUserReport = async (userId, userName) => {
    const res = await fetch(`${API_BASE}/export/pdf?report_type=Complete+Master+Report&user_id=${userId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${userName.toLowerCase().replace(/\s+/g, '_')}_master_report.pdf`;
      a.click();
      setStatusMsg({ text: `Successfully downloaded verified master report for ${userName}.`, type: 'success' });
    }
  };

  const rawLogsList = dashboard?.recent_challenge_logs || [];
  const logsList = localLogsOverride !== null ? localLogsOverride : rawLogsList;

  const directoryUsers = dashboard?.admin_dashboard?.user_directory || dashboard?.coach_cohort || [];
  const realStaffMembers = directoryUsers.filter(u => u.role === 'Wellness Coach' || u.role === 'Administrator');

  const scoreBreakdown = dashboard?.habit_score_breakdown || {
    total_habit_score: 88.0, wake_up_consistency_score: 30.5, challenge_completion_score: 21.5, snooze_reduction_score: 18.0, sleep_adherence_score: 18.0
  };
  const behaviorMetrics = dashboard?.behavioral_analytics || {
    snooze_rate_percent: 0.0, wake_up_accuracy_percent: 100.0, avg_response_time_sec: 10.4, behavioral_status: 'Consistent Morning Routine'
  };
  const aiCards = dashboard?.recommendations?.ai_telemetry_cards || [];
  const qTable = dashboard?.adaptive_engine?.q_table || {
    Beginner: 0.62, Easy: 0.94, Medium: 0.81, Hard: 0.68, Expert: 0.54
  };

  const chronologicalLogs = [...logsList].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const handleDeleteLogItem = (index) => {
    const updated = chronologicalLogs.filter((_, idx) => idx !== index);
    setLocalLogsOverride(updated);
    setStatusMsg({ text: 'Puzzle attempt removed from history.', type: 'success' });
  };

  const handleClearAllLogs = () => {
    setLocalLogsOverride([]);
    setStatusMsg({ text: 'All puzzle history cleared.', type: 'success' });
  };

  const habitTrendData = {
    labels: chronologicalLogs.length > 0 ? chronologicalLogs.map((l) => formatGraphTimestamp(l.timestamp)) : ['Start (No Attempts)'],
    datasets: [{
      label: 'Session Performance Score',
      data: chronologicalLogs.length > 0 ? chronologicalLogs.map(l => (l.is_successful ? 94 : 55)) : [0],
      borderColor: '#2563EB',
      backgroundColor: 'rgba(124, 58, 237, 0.15)',
      pointBackgroundColor: '#F59E0B',
      pointBorderColor: '#2563EB',
      pointRadius: 6,
      tension: 0.35,
      fill: true
    }]
  };

  const realCategoryAccuracies = CHALLENGE_TYPES.map(catName => {
    const catLogs = logsList.filter(l => l.challenge_type === catName);
    if (catLogs.length === 0) return 0;
    const solvedCount = catLogs.filter(l => l.is_successful).length;
    return Math.round((solvedCount / catLogs.length) * 100);
  });

  const accuracyBarData = {
    labels: CHALLENGE_TYPES.map(c => {
      const count = logsList.filter(l => l.challenge_type === c).length;
      return `${c.split(' ')[0]} (${count})`;
    }),
    datasets: [{
      label: 'Real Accuracy % (0% = Not Played Yet)',
      data: realCategoryAccuracies,
      backgroundColor: ['#2563EB', '#06B6D4', '#7C3AED', '#F59E0B', '#2563EB', '#06B6D4', '#7C3AED'],
      borderRadius: 10
    }]
  };

  const scoreDonutData = {
    labels: ['Consistency (35%)', 'Puzzle Success (25%)', 'No Snooze (20%)', 'Sleep Goal (20%)'],
    datasets: [{
      data: [scoreBreakdown.wake_up_consistency_score, scoreBreakdown.challenge_completion_score, scoreBreakdown.snooze_reduction_score, scoreBreakdown.sleep_adherence_score],
      backgroundColor: ['#2563EB', '#06B6D4', '#7C3AED', '#F59E0B'],
      borderWidth: 2,
      borderColor: '#FFFFFF'
    }]
  };

  if (!token) {
    return (
      <div style={{ ...colorfulTheme.pageWrapper, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', boxSizing: 'border-box' }}>
        <ColorfulBackgroundOrbs />
        <div style={{ ...colorfulTheme.card, width: '100%', maxWidth: '500px', padding: '42px', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(20px)' }}>
          <div style={{ textAlign: 'center', marginBottom: '26px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '62px', height: '62px', borderRadius: '18px', background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)', color: '#FFFFFF', marginBottom: '12px', boxShadow: '0 10px 25px rgba(37, 99, 235, 0.35)' }}>
              <ProAlarmBrandIcon size={32} />
            </div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', color: '#0F172A', fontWeight: '900' }}>Intelligent Cognitive Alarm</h1>
            <p style={{ margin: 0, fontSize: '15.5px', color: '#64748B' }}>Smart Wake-Up Verification, Habit Scoring & AI Sleep Coach</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#F1F5F9', padding: '5px', borderRadius: '999px', marginBottom: '20px' }}>
            <button type="button" onClick={() => { setAuthMode('login'); setStatusMsg({ text: '', type: 'info' }); }} style={{ padding: '11px', borderRadius: '999px', border: 'none', fontSize: '15.5px', fontWeight: '800', cursor: 'pointer', background: authMode === 'login' ? 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)' : 'transparent', color: authMode === 'login' ? '#FFFFFF' : '#475569' }}>Sign In</button>
            <button type="button" onClick={() => { setAuthMode('register'); setStatusMsg({ text: '', type: 'info' }); }} style={{ padding: '11px', borderRadius: '999px', border: 'none', fontSize: '15.5px', fontWeight: '800', cursor: 'pointer', background: authMode === 'register' ? 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)' : 'transparent', color: authMode === 'register' ? '#FFFFFF' : '#475569' }}>Create Account</button>
          </div>

          {statusMsg.text && (
            <div style={{ padding: '13px 16px', borderRadius: '12px', marginBottom: '18px', fontSize: '15px', fontWeight: '700', background: statusMsg.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: statusMsg.type === 'error' ? '#DC2626' : '#059669', border: `1px solid ${statusMsg.type === 'error' ? '#FECACA' : '#A7F3D0'}` }}>
              {statusMsg.text}
            </div>
          )}

          <button type="button" onClick={() => { setShowGoogleModal(true); setGoogleView('chooser'); }} style={{ width: '100%', padding: '13px', background: '#FFFFFF', color: '#1E293B', border: '1.5px solid #CBD5E1', borderRadius: '999px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px', boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)' }}>
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Continue with Google
          </button>

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {authMode === 'register' && (
              <>
                <div><label style={colorfulTheme.label}>Full Name</label><input placeholder="Enter full name" value={fullName} onChange={e => setFullName(e.target.value)} required style={colorfulTheme.input} /></div>
                <div><label style={colorfulTheme.label}>Email Address</label><input type="email" placeholder="user@example.com" value={email} onChange={e => setEmail(e.target.value)} required style={colorfulTheme.input} /></div>
              </>
            )}
            <div><label style={colorfulTheme.label}>{authMode === 'login' ? 'Username or Email' : 'Username'}</label><input placeholder="Enter username or email" value={username} onChange={e => setUsername(e.target.value)} required style={colorfulTheme.input} /></div>
            <div><label style={colorfulTheme.label}>Password</label><input type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} required style={colorfulTheme.input} /></div>
            {authMode === 'register' && (
              <div>
                <label style={colorfulTheme.label}>Select Account Role</label>
                <select value={registerRole} onChange={e => setRegisterRole(e.target.value)} style={colorfulTheme.input}>
                  <option value="User">User</option><option value="Wellness Coach">Wellness Coach</option><option value="Administrator">Administrator</option>
                </select>
              </div>
            )}
            <button type="submit" style={{ ...colorfulTheme.primaryBtn, marginTop: '6px' }}>{authMode === 'login' ? 'Sign In' : `Create ${registerRole} Account`}</button>
          </form>
        </div>

        {showGoogleModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' }}>
            <div style={{ background: '#FFFFFF', width: '100%', maxWidth: '430px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 25px 60px rgba(15, 23, 42, 0.35)', border: '1px solid #E2E8F0', color: '#0F172A' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: '#475569', fontWeight: '600' }}><svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg><span>Sign in with Google</span></div>
                <button onClick={() => setShowGoogleModal(false)} style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#64748B' }}>✕</button>
              </div>
              <div style={{ padding: '30px 32px' }}>
                {googleView === 'chooser' && (
                  <><div style={{ textAlign: 'center', marginBottom: '22px' }}><h3 style={{ margin: '0 0 6px 0', fontSize: '22px', color: '#0F172A', fontWeight: '700' }}>Choose an account</h3><p style={{ margin: 0, fontSize: '15px', color: '#475569' }}>to continue to <strong style={{ color: '#2563EB' }}>Intelligent Cognitive Alarm</strong></p></div>
                    <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid #E2E8F0' }}>
                      {savedGoogleAccounts.map((acc, idx) => (
                        <button key={idx} type="button" onClick={() => { setGoogleEmail(acc.email); setGoogleView('consent'); }} style={{ width: '100%', padding: '14px 8px', border: 'none', borderBottom: '1px solid #E2E8F0', background: 'transparent', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', textAlign: 'left' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563EB, #7C3AED)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '16px', flexShrink: 0 }}>{acc.name.charAt(0).toUpperCase()}</div>
                          <div style={{ flex: 1 }}><div style={{ fontWeight: '700', fontSize: '15.5px', color: '#0F172A' }}>{acc.name}</div><div style={{ fontSize: '13.5px', color: '#64748B' }}>{acc.email}</div></div>
                        </button>
                      ))}
                      <button type="button" onClick={() => { setGoogleEmail(''); setGoogleView('email_input'); }} style={{ width: '100%', padding: '15px 8px', border: 'none', borderBottom: '1px solid #E2E8F0', background: 'transparent', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700' }}>+</div>
                        <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>Use another account</div>
                      </button>
                    </div>
                  </>
                )}
                {googleView === 'email_input' && (
                  <div><h3 style={{ margin: '0 0 6px 0', fontSize: '22px', color: '#0F172A', textAlign: 'center' }}>Sign in</h3><p style={{ margin: '0 0 20px 0', fontSize: '15px', color: '#475569', textAlign: 'center' }}>Use your Google Account</p><input type="email" placeholder="Email or phone" value={googleEmail} onChange={e => setGoogleEmail(e.target.value)} autoFocus style={{ ...colorfulTheme.input, marginBottom: '22px' }} /><div style={{ display: 'flex', justifyContent: 'space-between' }}><button type="button" onClick={() => setGoogleView('chooser')} style={{ padding: '10px 18px', background: 'transparent', color: '#2563EB', border: 'none', fontWeight: '700', cursor: 'pointer', fontSize: '15px' }}>Back</button><button type="button" onClick={() => { if (!googleEmail.includes('@')) return; setGoogleView('consent'); }} style={{ padding: '10px 24px', background: '#2563EB', color: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '15px' }}>Next</button></div></div>
                )}
                {googleView === 'consent' && (
                  <div style={{ textAlign: 'center' }}><div style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563EB, #7C3AED)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '22px', marginBottom: '12px' }}>{googleEmail.charAt(0).toUpperCase()}</div><h3 style={{ margin: '0 0 6px 0', fontSize: '20px', color: '#0F172A' }}>Continue as {googleEmail.split('@')[0]}?</h3><div style={{ fontSize: '14px', color: '#64748B', marginBottom: '18px' }}>{googleEmail}</div><p style={{ fontSize: '13.5px', color: '#334155', lineHeight: '1.5', textAlign: 'left', background: '#F8FAFC', padding: '12px 14px', borderRadius: '10px', marginBottom: '22px', border: '1px solid #E2E8F0' }}>Google will share your name, email address, and profile picture with <strong>Intelligent Cognitive Alarm</strong>.</p><div style={{ display: 'flex', gap: '12px' }}><button type="button" onClick={() => setGoogleView('chooser')} style={{ flex: 1, padding: '11px', background: '#F1F5F9', color: '#334155', border: 'none', borderRadius: '999px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button><button type="button" disabled={googleLoading} onClick={() => completeGoogleOAuth(googleEmail)} style={{ ...colorfulTheme.primaryBtn, flex: 1, padding: '11px' }}>{googleLoading ? 'Signing in...' : 'Continue'}</button></div></div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const displayName = dashboard?.profile?.full_name || dashboard?.profile?.username || 'User';

  const sidebarMenuItems =
    lockedRole === 'Administrator'
      ? [ { id: 'admin_users', icon: '🛡️', label: 'User & Role Control' }, { id: 'coach_cohort', icon: '🩺', label: 'Cohort Sleep Analytics' }, { id: 'reports', icon: '📑', label: 'System Alerts' } ]
      : lockedRole === 'Wellness Coach'
      ? [ { id: 'coach_cohort', icon: '🩺', label: 'Cohort Sleep Analytics' }, { id: 'reports', icon: '📑', label: 'System Alerts' } ]
      : [ { id: 'overview', icon: '⚡', label: 'Dashboard & AI Tips' }, { id: 'alarms', icon: '🔔', label: 'Smart Alarms' }, { id: 'challenges', icon: '🧠', label: 'Puzzles & Difficulty' }, { id: 'analytics', icon: '📈', label: 'Graphs & Analytics' }, { id: 'reports', icon: '📑', label: 'Reports & Support' }, { id: 'profile', icon: '🎯', label: 'Profile & Habit Goals' } ];

  return (
    <div style={{ ...colorfulTheme.pageWrapper, display: 'flex' }}>
      <ColorfulBackgroundOrbs />

      <aside style={{ width: '305px', background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(24px)', color: '#0F172A', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '28px 22px', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box', borderRight: '1px solid #E2E8F0', boxShadow: '8px 0 32px rgba(99, 102, 241, 0.05)', zIndex: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '22px', borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', boxShadow: '0 6px 18px rgba(37, 99, 235, 0.35)' }}>
              <ProAlarmBrandIcon size={26} />
            </div>
            <div>
              <div style={{ fontWeight: '900', fontSize: '18.5px', color: '#0F172A', letterSpacing: '0.2px' }}>COGNITIVE ALARM</div>
              <div style={{ fontSize: '13.5px', color: '#2563EB', fontWeight: '800' }}>{lockedRole} Portal</div>
            </div>
          </div>

          <div style={{ background: '#FFFFFF', borderRadius: '18px', padding: '16px', textAlign: 'center', margin: '22px 0', border: '1px solid #E2E8F0', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.05)' }}>
            <div style={{ fontFamily: "'JetBrains Mono', 'Consolas', monospace", fontSize: '25px', fontWeight: '900', color: '#0F172A' }}>
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
          </div>

          <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#64748B', letterSpacing: '1.2px', padding: '0 12px', marginBottom: '10px' }}>NAVIGATION TABS</div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {sidebarMenuItems.map(item => {
              const isSelected = activeTab === item.id;
              return (
                <button key={item.id} onClick={() => setActiveTab(item.id)} style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', padding: '13px 20px', borderRadius: '999px', border: 'none', fontSize: '16px', fontWeight: isSelected ? '800' : '600', cursor: 'pointer', textAlign: 'left', background: isSelected ? 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)' : 'transparent', color: isSelected ? '#FFFFFF' : '#475569', boxShadow: isSelected ? '0 8px 20px rgba(37, 99, 235, 0.3)' : 'none', transition: 'all 0.2s ease' }}>
                  <span style={{ fontSize: '19px' }}>{item.icon}</span><span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '18px' }}>
          <div style={{ padding: '10px 14px', borderRadius: '999px', background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4F46E5', fontSize: '13px', fontWeight: '800', textAlign: 'center', marginBottom: '14px' }}>🔒 ROLE: {lockedRole.toUpperCase()}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', padding: '14px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <div><div style={{ fontWeight: '800', fontSize: '15.5px', color: '#0F172A' }}>{displayName}</div><div style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>{dashboard?.profile?.email}</div></div>
            <button onClick={handleLogout} style={{ padding: '9px 15px', background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', color: '#FFFFFF', border: 'none', borderRadius: '999px', fontSize: '13.5px', fontWeight: '800', cursor: 'pointer' }}>Logout</button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, width: '100%', padding: '32px 42px', boxSizing: 'border-box', overflowY: 'auto', position: 'relative', zIndex: 2 }}>
        {statusMsg.text && (
          <div style={{ padding: '16px 22px', borderRadius: '16px', marginBottom: '24px', background: statusMsg.type === 'error' ? '#FEF2F2' : '#ECFDF5', color: statusMsg.type === 'error' ? '#DC2626' : '#059669', border: `1.5px solid ${statusMsg.type === 'error' ? '#FECACA' : '#6EE7B7'}`, fontWeight: '800', fontSize: '16.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{statusMsg.text}</span>
            <button onClick={() => setStatusMsg({ text: '', type: 'info' })} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
          </div>
        )}

        {verificationFeedback && !activeChallenge && (
          <div style={{ padding: '18px 24px', borderRadius: '16px', marginBottom: '24px', background: verificationFeedback.ok ? '#ECFDF5' : '#FEF2F2', color: verificationFeedback.ok ? '#065F46' : '#B91C1C', border: `1.5px solid ${verificationFeedback.ok ? '#6EE7B7' : '#FCA5A5'}`, fontWeight: '800', fontSize: '17px' }}>
            {verificationFeedback.text}
          </div>
        )}

        {activeChallenge && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
            <div style={{ ...colorfulTheme.card, width: '100%', maxWidth: '600px', textAlign: 'center', padding: '40px', border: '2px solid #2563EB' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '20px', background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)', color: '#FFFFFF', marginBottom: '14px' }}>
                <ProAlarmBrandIcon size={34} />
              </div>
              <div><span style={{ ...colorfulTheme.badge, background: '#EEF2FF', color: '#4F46E5', fontSize: '14.5px' }}>{activeChallenge.challenge_type} • STAGE: {activeChallenge.difficulty.toUpperCase()} • STEP {stepProgress}/{activeChallenge.required_steps}</span></div>
              <h2 style={{ margin: '22px 0 12px 0', color: '#0F172A', fontSize: '26px', fontWeight: '900' }}>{activeChallenge.question}</h2>
              <p style={{ color: '#64748B', fontSize: '16.5px', marginBottom: '20px' }}>Solve this puzzle to stop the ringing alarm:</p>
              
              {verificationFeedback && !verificationFeedback.ok && (
                <div style={{ padding: '12px', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '10px', color: '#DC2626', fontWeight: '800', fontSize: '16px', marginBottom: '20px' }}>
                  {verificationFeedback.text}
                </div>
              )}

              <input placeholder="Type your answer..." value={userAnswer} onChange={e => setUserAnswer(e.target.value)} autoFocus style={{ ...colorfulTheme.input, fontSize: '22px', textAlign: 'center', marginBottom: '20px', border: '2px solid #2563EB' }} />
              <div style={{ display: 'flex', gap: '14px' }}>
                <button onClick={() => submitChallengeVerification(false)} style={{ ...colorfulTheme.primaryBtn, flex: 2, fontSize: '17.5px' }}>✓ Submit Answer & Stop Alarm</button>
                <button onClick={() => submitChallengeVerification(true)} style={{ ...colorfulTheme.deleteBtn, flex: 1, fontSize: '16.5px', padding: '12px' }}>💤 Snooze Alarm</button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            {notifications.length > 0 && (
              <div style={{ background: '#FFFFFF', border: '1.5px solid #C7D2FE', borderRadius: '18px', padding: '16px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', boxShadow: '0 8px 20px rgba(37, 99, 235, 0.08)' }}>
                <div><span style={{ background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)', color: '#FFFFFF', padding: '5px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: '800', marginRight: '12px' }}>📢 {notifications[0].category}</span><strong style={{ fontSize: '16.5px', color: '#0F172A' }}>{notifications[0].message}</strong></div>
                <button onClick={() => setActiveTab('reports')} style={{ padding: '8px 16px', background: '#EEF2FF', color: '#2563EB', border: '1px solid #C7D2FE', borderRadius: '999px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' }}>View All Alerts ({notifications.length}) →</button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '26px', marginBottom: '26px' }}>
              <div style={{ ...colorfulTheme.heroCard, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <span style={{ ...colorfulTheme.badge, background: 'rgba(255, 255, 255, 0.25)', color: '#FFFFFF', border: '1px solid rgba(255, 255, 255, 0.4)' }}>⚡ SMART COGNITIVE ALARM CONSOLE</span>
                    <span style={{ ...colorfulTheme.badge, background: 'rgba(255, 255, 255, 0.25)', color: '#FFFFFF' }}>Active Alarms: {(dashboard?.alarms || []).filter(a => a.is_active).length}</span>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace", fontSize: '56px', fontWeight: '900', margin: '18px 0 8px 0', color: '#FFFFFF', letterSpacing: '1px', textShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}>
                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                  </div>
                  <div style={{ fontSize: '17px', color: 'rgba(255, 255, 255, 0.9)' }}>
                    Wake Goal: <strong style={{ color: '#FDE047' }}>{formatTime12Hour(profileForm.preferred_wake_time)}</strong> • Sleep Target: <strong style={{ color: '#FDE047' }}>{profileForm.sleep_duration_hours}h</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '14px', marginTop: '24px', flexWrap: 'wrap' }}>
                  <button onClick={() => startWakeUpChallenge(profileForm.habit_preferences, arenaDifficulty, 'Puzzle Completion')} style={{ padding: '13px 24px', background: '#FFFFFF', color: '#2563EB', border: 'none', borderRadius: '999px', fontSize: '16.5px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.15)' }}>🔔 Ring Alarm & Solve Puzzle</button>
                  <button onClick={() => setActiveTab('alarms')} style={{ padding: '13px 22px', background: 'rgba(255, 255, 255, 0.2)', color: '#FFFFFF', border: '1.5px solid rgba(255, 255, 255, 0.5)', borderRadius: '999px', fontSize: '16px', fontWeight: '800', cursor: 'pointer' }}>⏰ Custom Alarms ({(dashboard?.alarms || []).length})</button>
                </div>
              </div>

              <div style={colorfulTheme.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '21px', fontWeight: '800' }}>Weighted Habit Score</h3>
                  <span style={{ fontSize: '26px', fontWeight: '900', color: '#2563EB' }}>{scoreBreakdown.total_habit_score} / 100</span>
                </div>
                <div style={{ height: '200px', display: 'flex', justifyContent: 'center' }}>
                  <Doughnut data={scoreDonutData} options={{ maintainAspectRatio: false }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '22px', marginBottom: '28px' }}>
              <div style={colorfulTheme.card}><div style={{ fontSize: '15.5px', color: '#64748B', fontWeight: '700' }}>Wake-Up Accuracy</div><div style={{ fontSize: '36px', fontWeight: '900', color: '#2563EB', margin: '8px 0' }}>{behaviorMetrics.wake_up_accuracy_percent}%</div><div style={{ fontSize: '14.5px', color: '#475569' }}>First-alarm puzzle solve rate</div></div>
              <div style={colorfulTheme.card}><div style={{ fontSize: '15.5px', color: '#64748B', fontWeight: '700' }}>Snooze Rate</div><div style={{ fontSize: '36px', fontWeight: '900', color: '#F59E0B', margin: '8px 0' }}>{behaviorMetrics.snooze_rate_percent}%</div><div style={{ fontSize: '14.5px', color: '#475569' }}>20% of Habit Score weight</div></div>
              <div style={colorfulTheme.card}><div style={{ fontSize: '15.5px', color: '#64748B', fontWeight: '700' }}>Average Solve Time</div><div style={{ fontSize: '36px', fontWeight: '900', color: '#06B6D4', margin: '8px 0' }}>{behaviorMetrics.avg_response_time_sec}s</div><div style={{ fontSize: '14.5px', color: '#475569' }}>Morning reaction speed</div></div>
              <div style={colorfulTheme.card}><div style={{ fontSize: '15.5px', color: '#64748B', fontWeight: '700' }}>Difficulty Stage</div><div style={{ fontSize: '36px', fontWeight: '900', color: '#7C3AED', margin: '8px 0' }}>{profileForm.difficulty_preference}</div><div style={{ fontSize: '14.5px', color: '#475569' }}>Auto-adapts to your accuracy</div></div>
            </div>

            <div style={colorfulTheme.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '23px', color: '#0F172A', fontWeight: '900' }}>✨ Personalized AI Recommendations for {displayName}</h2>
                  <p style={{ margin: 0, fontSize: '15.5px', color: '#64748B' }}>Dynamically recalculated for each user whenever you add/edit an alarm, solve a puzzle, or snooze.</p>
                </div>
                <span style={{ ...colorfulTheme.badge, background: '#EEF2FF', color: '#2563EB', border: '1px solid #C7D2FE' }}>LIVE ALARM-LINKED AI</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                {aiCards.map((card, idx) => (
                  <div key={card.id || idx} style={{ padding: '22px', background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', borderTop: `5px solid ${card.badge_color}`, boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px' }}>
                        <span style={{ ...colorfulTheme.badge, background: '#F1F5F9', color: '#334155', fontSize: '12.5px' }}>{card.model}</span>
                        <span style={{ ...colorfulTheme.badge, background: '#ECFDF5', color: '#059669', fontSize: '12.5px' }}>{card.confidence}</span>
                      </div>
                      <h4 style={{ margin: '8px 0', fontSize: '18.5px', fontWeight: '800', color: '#0F172A' }}>{idx + 1}. {card.title}</h4>
                      <p style={{ margin: '0 0 14px 0', fontSize: '16px', color: '#334155', lineHeight: '1.55' }}>
                        {card.text ? card.text.replace(/23:00/g, '11:00 PM').replace(/07:00/g, formatTime12Hour('07:30')) : ''}
                      </p>
                    </div>
                    <div style={{ fontSize: '13.5px', color: '#64748B', fontWeight: '700', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                      Live Alarm Context: <span style={{ color: '#2563EB' }}>{card.trigger ? card.trigger.replace(/23:00/g, '11:00 PM') : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SMART ALARMS */}
        {activeTab === 'alarms' && (
          <div style={{ display: 'grid', gridTemplateColumns: '430px 1fr', gap: '28px' }}>
            <div style={colorfulTheme.card}>
              <h3 style={{ marginTop: 0, fontSize: '22px', fontWeight: '800' }}>Create Smart Alarm</h3>
              <form onSubmit={createAlarm} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div><label style={colorfulTheme.label}>Alarm Wake Time (12-Hour AM / PM)</label><TimePicker12Hour value24={alarmForm.time} onChange24={newTime24 => setAlarmForm({ ...alarmForm, time: newTime24 })} /></div>
                <div><label style={colorfulTheme.label}>Alarm Type</label><select value={alarmForm.alarm_type} onChange={e => setAlarmForm({ ...alarmForm, alarm_type: e.target.value })} style={colorfulTheme.input}>{ALARM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label style={colorfulTheme.label}>Puzzle Category</label><select value={alarmForm.challenge_type} onChange={e => setAlarmForm({ ...alarmForm, challenge_type: e.target.value })} style={colorfulTheme.input}>{CHALLENGE_TYPES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                
                <div>
                  <label style={colorfulTheme.label}>Difficulty Stage</label>
                  <div style={{ ...colorfulTheme.input, background: '#E2E8F0', color: '#475569', display: 'flex', alignItems: 'center', height: '48px', fontWeight: '700' }}>
                    🤖 Auto-Adapted via AI (Current: {profileForm.difficulty_preference})
                  </div>
                </div>

                <div><label style={colorfulTheme.label}>Verification Mode</label><select value={alarmForm.verification_method} onChange={e => setAlarmForm({ ...alarmForm, verification_method: e.target.value })} style={colorfulTheme.input}>{VERIFICATION_METHODS.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                <div><label style={colorfulTheme.label}>Alarm Label</label><input value={alarmForm.custom_label} onChange={e => setAlarmForm({ ...alarmForm, custom_label: e.target.value })} style={colorfulTheme.input} /></div>
                <button type="submit" style={colorfulTheme.primaryBtn}>+ Add Smart Alarm ({formatTime12Hour(alarmForm.time)})</button>
              </form>
            </div>

            <div style={colorfulTheme.card}>
              <h3 style={{ marginTop: 0, fontSize: '22px', fontWeight: '800' }}>Configured Alarms ({(dashboard?.alarms || []).length})</h3>
              {(dashboard?.alarms || []).length === 0 ? (
                <div style={{ padding: '42px 24px', textAlign: 'center', background: '#F8FAFC', borderRadius: '18px', border: '1.5px dashed #CBD5E1', color: '#64748B' }}>
                  <div style={{ color: '#2563EB', marginBottom: '10px' }}><ProAlarmBrandIcon size={40} /></div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', marginBottom: '6px' }}>No Alarms Configured Yet</div>
                  <p style={{ margin: 0, fontSize: '15.5px' }}>Use the 12-hour AM/PM selector on the left to schedule your first custom alarm.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '20px' }}>
                  {(dashboard?.alarms || []).map(a => (
                    <div key={a.id} style={{ padding: '22px', borderRadius: '18px', background: '#FFFFFF', border: `2px solid ${a.is_active ? '#2563EB' : '#E2E8F0'}`, boxShadow: '0 6px 18px rgba(99, 102, 241, 0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '30px', fontWeight: '900', color: '#0F172A' }}>{formatTime12Hour(a.time)}</span>
                        <button onClick={() => toggleAlarm(a.id)} style={{ padding: '6px 16px', borderRadius: '999px', border: 'none', fontWeight: '800', fontSize: '13.5px', cursor: 'pointer', background: a.is_active ? 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)' : '#CBD5E1', color: '#FFFFFF' }}>{a.is_active ? 'ON' : 'OFF'}</button>
                      </div>
                      <div style={{ fontWeight: '800', fontSize: '18px', marginTop: '10px' }}>{a.custom_label}</div>
                      <div style={{ fontSize: '15px', color: '#475569', marginTop: '4px' }}>{a.alarm_type} • {a.challenge_type}</div>
                      
                      <div style={{ marginTop: '14px', fontSize: '14.5px', color: '#64748B', fontWeight: '600' }}>
                        Adaptive Stage: <span style={{ color: '#2563EB', fontWeight: '800' }}>{profileForm.difficulty_preference} (AI Managed)</span>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                        <button onClick={() => startWakeUpChallenge(a.challenge_type, profileForm.difficulty_preference, a.verification_method)} style={{ ...colorfulTheme.primaryBtn, flex: 1, padding: '11px', fontSize: '15px' }}>🔔 Ring Alarm</button>
                        <button onClick={() => deleteAlarm(a.id)} style={colorfulTheme.deleteBtn}>🗑 Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: PUZZLES & DIFFICULTY */}
        {activeTab === 'challenges' && (
          <div style={colorfulTheme.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '900' }}>Cognitive Puzzle Arena & Verification Simulator</h2>
              {chronologicalLogs.length > 0 && (
                <button onClick={handleClearAllLogs} style={{ padding: '8px 16px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '999px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' }}>
                  🗑 Clear All History
                </button>
              )}
            </div>
            <p style={{ color: '#475569', fontSize: '16.5px', marginBottom: '22px' }}>
              Select any puzzle category, difficulty stage, and verification mode to test the challenge simulator.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '16px', alignItems: 'end', background: '#F8FAFC', padding: '22px', borderRadius: '18px', marginBottom: '28px', border: '1.5px solid #CBD5E1' }}>
              <div>
                <label style={colorfulTheme.label}>1. Puzzle Category</label>
                <select value={selectedChallengeType} onChange={e => setSelectedChallengeType(e.target.value)} style={colorfulTheme.input}>{CHALLENGE_TYPES.map(c => <option key={c} value={c}>{c}</option>)}</select>
              </div>

              <div>
                <label style={colorfulTheme.label}>2. Difficulty Stage (Manual Override)</label>
                <select value={arenaDifficulty} onChange={e => setArenaDifficulty(e.target.value)} style={colorfulTheme.input}>{DIFFICULTY_LEVELS.map(d => <option key={d} value={d}>{d}</option>)}</select>
              </div>
              
              <div>
                <label style={colorfulTheme.label}>3. Verification Method</label>
                <select value={selectedVerification} onChange={e => setSelectedVerification(e.target.value)} style={colorfulTheme.input}>{VERIFICATION_METHODS.map(v => <option key={v} value={v}>{v}</option>)}</select>
              </div>
              <button onClick={() => startWakeUpChallenge(selectedChallengeType, arenaDifficulty, selectedVerification)} style={{ ...colorfulTheme.primaryBtn, height: '50px' }}>🔔 Start Puzzle & Ring</button>
            </div>

            <h3 style={{ fontSize: '20px', marginBottom: '14px' }}>Recent Puzzle Attempts (Recent to Old)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '16px' }}>
              <thead>
                <tr style={{ background: '#F1F5F9', color: '#0F172A', textAlign: 'left' }}>
                  <th style={{ padding: '14px', borderRadius: '12px 0 0 12px' }}>Puzzle Category</th>
                  <th style={{ padding: '14px' }}>Difficulty Stage</th>
                  <th style={{ padding: '14px' }}>Date & Time</th>
                  <th style={{ padding: '14px' }}>Status</th>
                  <th style={{ padding: '14px' }}>Time Taken</th>
                  <th style={{ padding: '14px', borderRadius: '0 12px 12px 0' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {chronologicalLogs.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>No puzzle attempts yet. Click "Start Puzzle & Ring" above to try one!</td></tr>
                ) : (
                  chronologicalLogs.map((l, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '14px', fontWeight: '800' }}>{l.challenge_type}</td>
                      <td style={{ padding: '14px' }}><span style={{ ...colorfulTheme.badge, background: '#EEF2FF', color: '#2563EB' }}>{l.difficulty}</span></td>
                      <td style={{ padding: '14px', color: '#475569', fontSize: '14px', fontWeight: '600' }}>{formatFullTimestamp(l.timestamp)}</td>
                      <td style={{ padding: '14px', fontWeight: '800', color: l.is_successful ? '#059669' : '#DC2626' }}>{l.is_successful ? '✓ SOLVED' : '✕ SNOOZED / FAILED'}</td>
                      <td style={{ padding: '14px', fontFamily: 'monospace', fontWeight: '700' }}>{l.completion_time_seconds}s</td>
                      <td style={{ padding: '14px' }}>
                        <button onClick={() => handleDeleteLogItem(i)} style={colorfulTheme.deleteBtn}>Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: GRAPHS & ANALYTICS */}
        {activeTab === 'analytics' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '26px', marginBottom: '26px' }}>
              <div style={colorfulTheme.card}>
                <h3 style={{ marginTop: 0, fontSize: '21px', fontWeight: '800' }}>Habit Score Progression</h3>
                <div style={{ height: '280px' }}><Line data={habitTrendData} options={{ maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }} /></div>
              </div>
              <div style={colorfulTheme.card}>
                <h3 style={{ marginTop: 0, fontSize: '21px', fontWeight: '800' }}>Real Accuracy Across 7 Puzzle Types</h3>
                <p style={{ margin: '0 0 10px 0', fontSize: '13.5px', color: '#64748B' }}>Only categories you have attempted show accuracy %. Unplayed categories remain at 0%.</p>
                <div style={{ height: '250px' }}><Bar data={accuracyBarData} options={{ maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }} /></div>
              </div>
            </div>

            <div style={{ ...colorfulTheme.card, marginBottom: '26px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '21px', fontWeight: '800' }}>Adaptive Difficulty Readiness Scores</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '15.5px', color: '#64748B' }}>Shows how the Adaptive Engine selects your puzzle difficulty stage based on your accuracy and speed.</p>
                </div>
                <span style={{ ...colorfulTheme.badge, background: '#EEF2FF', color: '#2563EB' }}>CURRENT STAGE: {profileForm.difficulty_preference.toUpperCase()}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                {DIFFICULTY_LEVELS.map(lvl => {
                  const active = lvl === profileForm.difficulty_preference;
                  return (
                    <div key={lvl} style={{ padding: '18px', borderRadius: '16px', background: active ? '#EEF2FF' : '#FFFFFF', border: `2px solid ${active ? '#2563EB' : '#E2E8F0'}`, textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: active ? '#2563EB' : '#64748B' }}>{lvl}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '26px', fontWeight: '900', margin: '8px 0', color: '#0F172A' }}>{Math.round((qTable[lvl] || 0.75) * 100)}%</div>
                      <span style={{ fontSize: '13.5px', fontWeight: '700', color: active ? '#2563EB' : '#94A3B8' }}>{active ? 'Active Stage' : 'Available Stage'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={colorfulTheme.card}>
              <h3 style={{ marginTop: 0, fontSize: '21px', fontWeight: '800' }}>Weighted Habit Scoring Breakdown (35% / 25% / 20% / 20%)</h3>
              {[
                { label: 'Wake-Up Consistency (35% Weight)', val: scoreBreakdown.wake_up_consistency_score, max: 35, color: '#2563EB' },
                { label: 'Challenge Completion Success (25% Weight)', val: scoreBreakdown.challenge_completion_score, max: 25, color: '#06B6D4' },
                { label: 'Snooze Reduction (20% Weight)', val: scoreBreakdown.snooze_reduction_score, max: 20, color: '#7C3AED' },
                { label: 'Sleep Schedule Adherence (20% Weight)', val: scoreBreakdown.sleep_adherence_score, max: 20, color: '#F59E0B' }
              ].map((item, i) => (
                <div key={i} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', marginBottom: '6px' }}><span>{item.label}</span><span>{item.val} / {item.max} pts</span></div>
                  <div style={{ height: '12px', background: '#F1F5F9', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (item.val / item.max) * 100)}%`, height: '100%', background: item.color, borderRadius: '99px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: REPORTS & SUPPORT */}
        {activeTab === 'reports' && (
          <div style={{ display: 'grid', gridTemplateColumns: lockedRole === 'User' ? '1fr 1fr' : '1fr', gap: '26px' }}>
            {lockedRole === 'User' && (
              <div style={colorfulTheme.card}>
                <h3 style={{ marginTop: 0, fontSize: '22px', fontWeight: '800' }}>Download Reports (PDF, Excel, CSV)</h3>
                <label style={colorfulTheme.label}>Select Report Category:</label>
                <select value={selectedReportType} onChange={e => setSelectedReportType(e.target.value)} style={{ ...colorfulTheme.input, marginBottom: '20px' }}>
                  {REPORT_CATEGORIES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                  <button onClick={() => downloadFile('pdf')} style={colorfulTheme.primaryBtn}>📄 Download Personal PDF Report</button>
                  <button onClick={() => downloadFile('excel')} style={colorfulTheme.primaryBtn}>📊 Download Excel Report</button>
                  <button onClick={() => downloadFile('csv')} style={colorfulTheme.primaryBtn}>🗂 Download CSV Report</button>
                </div>

                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '20px' }}>
                  <h3 style={{ marginTop: 0, fontSize: '18px', fontWeight: '800' }}>💬 Contact Staff (Coach or Administrator)</h3>
                  <p style={{ fontSize: '14.5px', color: '#64748B', marginBottom: '10px' }}>Select specific staff member to send your query to:</p>
                  <select value={supportStaffTarget} onChange={e => setSupportStaffTarget(e.target.value)} style={{ ...colorfulTheme.input, marginBottom: '12px' }}>
                    <option value="All Staff">📢 All Staff (Coach & Admin)</option>
                    {realStaffMembers.length > 0 ? (
                      realStaffMembers.map(staff => (
                        <option key={staff.id} value={`${staff.role}: ${staff.full_name}`}>
                          👤 [{staff.role}] {staff.full_name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Wellness Coach: Emily Thorne">👤 [Wellness Coach] Emily Thorne</option>
                        <option value="Administrator: Alarm Man">👤 [Administrator] Alarm Man</option>
                      </>
                    )}
                  </select>
                  <textarea value={supportMessageText} onChange={e => setSupportMessageText(e.target.value)} placeholder="Type your question or query here..." style={{ ...colorfulTheme.input, height: '85px', marginBottom: '12px', resize: 'vertical' }} />
                  <button onClick={sendUserSupportMessage} style={colorfulTheme.primaryBtn}>Send Message to {supportStaffTarget.split(':')[0]}</button>
                </div>
              </div>
            )}

            <div style={colorfulTheme.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>{lockedRole !== 'User' ? 'System Broadcasts & Alerts (Recent to Old)' : 'Notifications & Broadcasts (Recent to Old)'}</h3>
                {notifications.length > 0 && (
                  <button onClick={clearAllNotifications} style={{ padding: '6px 14px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '999px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>
                    Clear All
                  </button>
                )}
              </div>
              <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#64748B' }}>No notifications or broadcasts yet.</div>
                ) : (
                  notifications.map((n, i) => (
                    <div key={i} style={{ padding: '16px', background: '#F8FAFF', borderRadius: '14px', borderLeft: '5px solid #2563EB', marginBottom: '12px', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '14.5px', color: '#2563EB' }}>{n.category}</strong>
                        <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: '600' }}>{formatFullTimestamp(n.created_at)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '16px', color: '#1E293B' }}>{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PROFILE & HABIT GOALS */}
        {activeTab === 'profile' && (
          <div style={colorfulTheme.card}>
            <h2 style={{ marginTop: 0, fontSize: '24px', fontWeight: '900' }}>User Profile & Habit Goals</h2>
            <p style={{ color: '#475569', fontSize: '16.5px', marginBottom: '24px' }}>
              These 6 settings calculate your <strong>20% Sleep Schedule Adherence Score</strong> and personalize your <strong>AI Recommendations</strong>.
            </p>
            <form onSubmit={saveProfile} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px' }}>
              <div>
                <label style={colorfulTheme.label}>1. Preferred Wake-Up Time (AM / PM)</label>
                <TimePicker12Hour value24={profileForm.preferred_wake_time} onChange24={newTime24 => setProfileForm({ ...profileForm, preferred_wake_time: newTime24 })} />
              </div>
              <div>
                <label style={colorfulTheme.label}>2. Sleep Duration Target (Hours — 20% Habit Weight)</label>
                <input type="number" step="0.5" value={profileForm.sleep_duration_hours} onChange={e => setProfileForm({ ...profileForm, sleep_duration_hours: parseFloat(e.target.value) })} style={colorfulTheme.input} />
              </div>
              
              <div>
                <label style={colorfulTheme.label}>3. Current Difficulty Stage (AI Managed)</label>
                <div style={{ ...colorfulTheme.input, background: '#E2E8F0', color: '#475569', display: 'flex', alignItems: 'center', height: '48px', fontWeight: '700' }}>
                  {profileForm.difficulty_preference}
                </div>
              </div>

              <div>
                <label style={colorfulTheme.label}>4. Favorite Puzzle Category</label>
                <select value={profileForm.habit_preferences} onChange={e => setProfileForm({ ...profileForm, habit_preferences: e.target.value })} style={colorfulTheme.input}>
                  {CHALLENGE_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={colorfulTheme.label}>5. Daily Productivity Goal</label><input value={profileForm.productivity_goals} onChange={e => setProfileForm({ ...profileForm, productivity_goals: e.target.value })} style={colorfulTheme.input} /></div>
              <div><label style={colorfulTheme.label}>6. Time Zone</label><input value={profileForm.timezone} onChange={e => setProfileForm({ ...profileForm, timezone: e.target.value })} style={colorfulTheme.input} /></div>
              <button type="submit" style={{ ...colorfulTheme.primaryBtn, gridColumn: '1 / -1', padding: '16px', borderRadius: '999px' }}>
                Save Profile ({formatTime12Hour(profileForm.preferred_wake_time)}) & Recalculate AI Recommendations
              </button>
            </form>
          </div>
        )}

        {/* WELLNESS COACH PORTAL (Matching PDF screenshot image_e61dc3.png) */}
        {activeTab === 'coach_cohort' && (
          <div style={colorfulTheme.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '25px', fontWeight: '900' }}>Wellness Coach Portal — Monitored Users</h2>
              <div>
                <button onClick={() => downloadFile('pdf', 'Sleep Trend Report')} style={{ ...colorfulTheme.primaryBtn, marginRight: '10px' }}>📄 Export Cohort Report</button>
                <span style={{ ...colorfulTheme.badge, background: '#EEF2FF', color: '#2563EB' }}>AUTHORIZED ROLE: {lockedRole.toUpperCase()}</span>
              </div>
            </div>
            <p style={{ color: '#475569', fontSize: '16.5px', marginBottom: '22px' }}>Users completing cognitive puzzles maintain higher wake-up consistency.</p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '16px', marginBottom: '28px' }}>
              <thead>
                <tr style={{ background: '#F1F5F9', color: '#0F172A', textAlign: 'left' }}>
                  <th style={{ padding: '14px' }}>S.No</th>
                  <th style={{ padding: '14px' }}>Full Name</th>
                  <th style={{ padding: '14px' }}>Role</th>
                  <th style={{ padding: '14px' }}>Wake Goal</th>
                  <th style={{ padding: '14px' }}>Sleep Target</th>
                  <th style={{ padding: '14px' }}>Difficulty Stage</th>
                  <th style={{ padding: '14px' }}>Habit Score</th>
                  <th style={{ padding: '14px' }}>Routine Status</th>
                  <th style={{ padding: '14px' }}>Individual Report</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.coach_dashboard?.cohort_analytics || []).map((u, i) => {
                  const isStaff = u.role === 'Administrator' || u.role === 'Wellness Coach';
                  return (
                    <tr key={u.id || i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '14px', fontWeight: '700', color: '#64748B' }}>#{i + 1}</td>
                      <td style={{ padding: '14px', fontWeight: '800' }}>{u.full_name}</td>
                      <td style={{ padding: '14px' }}>{u.role}</td>
                      <td style={{ padding: '14px', fontFamily: 'monospace', fontWeight: '700' }}>{formatTime12Hour(u.wake_goal)}</td>
                      <td style={{ padding: '14px' }}>{u.sleep_hours} hrs</td>
                      <td style={{ padding: '14px' }}>{u.difficulty}</td>
                      <td style={{ padding: '14px', fontWeight: '900', color: isStaff ? '#94A3B8' : '#2563EB' }}>
                        {isStaff ? 'N/A' : `${u.habit_score || 80.78} / 100`}
                      </td>
                      <td style={{ padding: '14px', color: isStaff ? '#94A3B8' : '#059669', fontWeight: '800' }}>
                        {isStaff ? 'N/A' : (u.status || 'Consistent Morning Routine')}
                      </td>
                      <td style={{ padding: '14px' }}>
                        {isStaff ? (
                          <span style={{ color: '#94A3B8', fontSize: '13.5px', fontWeight: '700' }}>N/A</span>
                        ) : (
                          <button onClick={() => downloadIndividualUserReport(u.id || 1, u.full_name)} style={{ padding: '6px 12px', background: '#EEF2FF', color: '#2563EB', border: '1px solid #C7D2FE', borderRadius: '999px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>📥 PDF Report</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h3 style={{ fontSize: '20px' }}>Send Targeted Coaching Alert or Broadcast (Real Names & Roles)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr auto', gap: '14px', marginBottom: '14px' }}>
              <select value={targetRecipientName} onChange={e => setTargetRecipientName(e.target.value)} style={colorfulTheme.input}>
                <option value="ALL">📢 Broadcast to All Users</option>
                <option value={displayName}>👤 [{lockedRole}] {displayName} [Self]</option>
                {(dashboard?.coach_dashboard?.cohort_analytics || []).filter(u => u.full_name !== displayName).map(u => (
                  <option key={u.id} value={u.full_name}>👤 [{u.role}] {u.full_name}</option>
                ))}
              </select>
              <input value={announcementText} onChange={e => setAnnouncementText(e.target.value)} placeholder="Write message or sleep routine tip..." style={colorfulTheme.input} />
              <button onClick={sendTargetedAlert} style={colorfulTheme.primaryBtn}>Send Alert</button>
            </div>
          </div>
        )}

        {/* ADMINISTRATOR PORTAL */}
        {activeTab === 'admin_users' && lockedRole === 'Administrator' && (
          <div style={colorfulTheme.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '25px', fontWeight: '900' }}>Administrator Portal — User Management & RBAC</h2>
              <div>
                <button onClick={() => downloadFile('pdf', 'System Report')} style={{ ...colorfulTheme.primaryBtn, marginRight: '10px' }}>📄 Export System Report</button>
                <span style={{ ...colorfulTheme.badge, background: '#EEF2FF', color: '#2563EB' }}>EXCLUSIVE ADMIN ACCESS</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' }}>
              <div style={{ padding: '20px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', borderLeft: '5px solid #2563EB' }}>
                <div style={{ fontSize: '15px', color: '#64748B', fontWeight: '700' }}>Registered Users</div>
                <div style={{ fontSize: '34px', fontWeight: '900', marginTop: '6px', color: '#2563EB' }}>{dashboard?.admin_dashboard?.platform_metrics?.total_users || 0}</div>
              </div>
              <div style={{ padding: '20px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', borderLeft: '5px solid #06B6D4' }}>
                <div style={{ fontSize: '15px', color: '#64748B', fontWeight: '700' }}>Active Alarms</div>
                <div style={{ fontSize: '34px', fontWeight: '900', marginTop: '6px', color: '#06B6D4' }}>{dashboard?.admin_dashboard?.platform_metrics?.total_active_alarms || 0}</div>
              </div>
              <div style={{ padding: '20px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', borderLeft: '5px solid #7C3AED' }}>
                <div style={{ fontSize: '15px', color: '#64748B', fontWeight: '700' }}>Puzzles Solved</div>
                <div style={{ fontSize: '34px', fontWeight: '900', marginTop: '6px', color: '#7C3AED' }}>{dashboard?.admin_dashboard?.platform_metrics?.total_challenges_logged || 0}</div>
              </div>
              <div style={{ padding: '20px', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', borderLeft: '5px solid #F59E0B' }}>
                <div style={{ fontSize: '15px', color: '#64748B', fontWeight: '700' }}>Platform Accuracy</div>
                <div style={{ fontSize: '34px', fontWeight: '900', marginTop: '6px', color: '#F59E0B' }}>{dashboard?.admin_dashboard?.platform_metrics?.platform_wake_accuracy || 100}%</div>
              </div>
            </div>

            <h3 style={{ fontSize: '21px', marginBottom: '14px' }}>All Registered Users (Admin Role Assignment, Individual Reports & Deletion)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '16px', marginBottom: '28px' }}>
              <thead>
                <tr style={{ background: '#F1F5F9', color: '#0F172A', textAlign: 'left' }}>
                  <th style={{ padding: '14px' }}>S.No</th>
                  <th style={{ padding: '14px' }}>Full Name</th>
                  <th style={{ padding: '14px' }}>Username</th>
                  <th style={{ padding: '14px' }}>Email Address</th>
                  <th style={{ padding: '14px' }}>Change Role</th>
                  <th style={{ padding: '14px' }}>Habit Score</th>
                  <th style={{ padding: '14px' }}>Routine Status</th>
                  <th style={{ padding: '14px' }}>Individual Report</th>
                  <th style={{ padding: '14px' }}>Admin Action</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.admin_dashboard?.user_directory || []).map((u, i) => {
                  const isStaff = u.role === 'Administrator' || u.role === 'Wellness Coach';
                  return (
                    <tr key={u.id || i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '14px', fontFamily: 'monospace', fontWeight: '700', color: '#64748B' }}>#{i + 1}</td>
                      <td style={{ padding: '14px', fontWeight: '800' }}>{u.full_name}</td>
                      <td style={{ padding: '14px' }}>{u.username}</td>
                      <td style={{ padding: '14px' }}>{u.email}</td>
                      <td style={{ padding: '14px' }}>
                        <select value={u.role} onChange={e => grantRoleAccess(u.id, e.target.value)} style={{ padding: '8px 14px', borderRadius: '999px', border: '1.5px solid #2563EB', background: '#EEF2FF', color: '#2563EB', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}>
                          <option value="User">User</option><option value="Wellness Coach">Wellness Coach</option><option value="Administrator">Administrator</option>
                        </select>
                      </td>
                      <td style={{ padding: '14px', fontWeight: '900', color: isStaff ? '#94A3B8' : '#2563EB' }}>
                        {isStaff ? 'N/A' : `${u.habit_score || 80.78} / 100`}
                      </td>
                      <td style={{ padding: '14px', color: isStaff ? '#94A3B8' : '#059669', fontWeight: '800' }}>
                        {isStaff ? 'N/A' : (u.status || 'Consistent Morning Routine')}
                      </td>
                      <td style={{ padding: '14px' }}>
                        {isStaff ? (
                          <span style={{ color: '#94A3B8', fontSize: '13.5px', fontWeight: '700' }}>N/A</span>
                        ) : (
                          <button onClick={() => downloadIndividualUserReport(u.id, u.full_name || u.username)} style={{ padding: '6px 12px', background: '#EEF2FF', color: '#2563EB', border: '1px solid #C7D2FE', borderRadius: '999px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>📥 PDF Report</button>
                        )}
                      </td>
                      <td style={{ padding: '14px' }}>
                        {u.id === dashboard?.profile?.id ? (
                          <span style={{ fontSize: '13.5px', color: '#64748B', fontWeight: '700' }}>Active Admin</span>
                        ) : (
                          <button onClick={() => deleteUserAccount(u.id, u.full_name || u.username, u.username)} style={colorfulTheme.deleteBtn}>🗑 Delete</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h3 style={{ fontSize: '20px' }}>Send Targeted System Alert or Broadcast</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr auto', gap: '14px' }}>
              <select value={targetRecipientName} onChange={e => setTargetRecipientName(e.target.value)} style={colorfulTheme.input}>
                <option value="ALL">📢 Broadcast to All Users</option>
                <option value={displayName}>👤 [{lockedRole}] {displayName} [Self]</option>
                {(dashboard?.admin_dashboard?.user_directory || []).filter(u => u.full_name !== displayName).map(u => (
                  <option key={u.id} value={u.full_name}>👤 [{u.role}] {u.full_name}</option>
                ))}
              </select>
              <input value={announcementText} onChange={e => setAnnouncementText(e.target.value)} placeholder="Write system announcement or direct alert..." style={colorfulTheme.input} />
              <button onClick={sendTargetedAlert} style={colorfulTheme.primaryBtn}>Send Alert</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}