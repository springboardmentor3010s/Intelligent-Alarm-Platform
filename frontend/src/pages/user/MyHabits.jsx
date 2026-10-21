import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";

import API_URL from "../../config/api";

export default function MyHabits() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");
  const [habits, setHabits] = useState([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  
  // Dashboard state
  const [showDashboard, setShowDashboard] = useState(true);
  const [dashboardData, setDashboardData] = useState({ current: null, history: [], events: [] });
  const [recommendations, setRecommendations] = useState(null);
  const [alarms, setAlarms] = useState([]);
  const [cognitiveStats, setCognitiveStats] = useState(null);

  const [profile, setProfile] = useState(null);

  // Time filters
  const [scoreDays, setScoreDays] = useState(7);
  const [trendDays, setTrendDays] = useState(7);
  const [statsDays, setStatsDays] = useState(7);
  const [sleepDays, setSleepDays] = useState(7);
  const [perfDays, setPerfDays] = useState(7);

  useEffect(() => { 
    if (token) {
      loadHabits();
      loadDashboard();
      loadRecommendations();
      loadAlarms();
      loadCognitiveStats();
      loadProfile();
    }
  }, [token]);

  async function loadProfile() {
    try {
      const res = await fetch(`${API_URL}/profile`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setProfile(await res.json());
    } catch (err) { console.error(err); }
  }

  async function loadHabits() { 
    try { 
      const res = await fetch(`${API_URL}/habits`, { headers: { Authorization: `Bearer ${token}` } }); 
      if (res.ok) setHabits(await res.json()); 
    } catch (err) { console.error(err); } 
  }
  
  async function loadDashboard() {
    try { 
      const res = await fetch(`${API_URL}/analytics/dashboard`, { headers: { Authorization: `Bearer ${token}` } }); 
      if (res.ok) setDashboardData(await res.json()); 
    } catch (err) { console.error(err); } 
  }
  
  async function loadRecommendations() {
    try { 
      const res = await fetch(`${API_URL}/analytics/recommendations`, { headers: { Authorization: `Bearer ${token}` } }); 
      if (res.ok) setRecommendations(await res.json()); 
    } catch (err) { console.error(err); } 
  }

  async function loadAlarms() {
    try { 
      const res = await fetch(`${API_URL}/alarms`, { headers: { Authorization: `Bearer ${token}` } }); 
      if (res.ok) setAlarms(await res.json()); 
    } catch (err) { console.error(err); } 
  }

  async function loadCognitiveStats() {
    try {
      const res = await fetch(`${API_URL}/challenges/analytics/stats`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setCognitiveStats(await res.json());
    } catch (err) { console.error(err); }
  }

  async function toggleHabit(id) { 
    try { 
      await fetch(`${API_URL}/habits/${id}/toggle`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }); 
      loadHabits(); 
    } catch (err) { console.error(err); } 
  }
  
  async function deleteHabit(id) { 
    if (!confirm("Delete this habit?")) return; 
    try { 
      await fetch(`${API_URL}/habits/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); 
      loadHabits(); 
    } catch (err) { console.error(err); } 
  }
  
  function formatDate(value) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : null; }

  const categories = ["All", ...new Set(habits.map((habit) => habit.category))];
  const filtered = habits.filter((habit) => {
    if (search && !habit.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat !== "All" && habit.category !== filterCat) return false;
    if (filterStatus === "Completed" && !habit.completed) return false;
    if (filterStatus === "Pending" && habit.completed) return false;
    return true;
  });

  const { current, history, events, sleep_logs } = dashboardData;
  const habitScore = current?.habit_score || 0;
  
  const getFilteredHistory = (days) => {
    if (!history || history.length === 0) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0,0,0,0);
    const filtered = history.filter(h => new Date(h.date) >= cutoff);
    if (filtered.length === 0 && history.length > 0) {
      const maxDate = new Date(Math.max(...history.map(h => new Date(h.date).getTime())));
      const anchoredCutoff = new Date(maxDate);
      anchoredCutoff.setDate(anchoredCutoff.getDate() - days);
      anchoredCutoff.setHours(0,0,0,0);
      return history.filter(h => new Date(h.date) >= anchoredCutoff);
    }
    return filtered;
  };

  const getFilteredEvents = (days) => {
    if (!events || events.length === 0) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0,0,0,0);
    const filtered = events.filter(e => new Date(e.started_at) >= cutoff);
    if (filtered.length === 0 && events.length > 0) {
      const maxDate = new Date(Math.max(...events.map(e => new Date(e.started_at).getTime())));
      const anchoredCutoff = new Date(maxDate);
      anchoredCutoff.setDate(anchoredCutoff.getDate() - days);
      anchoredCutoff.setHours(0,0,0,0);
      return events.filter(e => new Date(e.started_at) >= anchoredCutoff);
    }
    return filtered;
  };

  const getFilteredSleepLogs = (days) => {
    const logs = sleep_logs || dashboardData?.sleep_logs || [];
    if (!logs || logs.length === 0) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0,0,0,0);
    const filtered = logs.filter(s => new Date(s.date) >= cutoff);
    if (filtered.length === 0 && logs.length > 0) {
      const maxDate = new Date(Math.max(...logs.map(s => new Date(s.date).getTime())));
      const anchoredCutoff = new Date(maxDate);
      anchoredCutoff.setDate(anchoredCutoff.getDate() - days);
      anchoredCutoff.setHours(0,0,0,0);
      return logs.filter(s => new Date(s.date) >= anchoredCutoff);
    }
    return filtered;
  };

  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  };

  const getLogDurationHours = (log) => {
    const sleepM = parseTimeToMinutes(log.actual_sleep_time);
    const wakeM = parseTimeToMinutes(log.actual_wake_time);
    if (sleepM === null || wakeM === null) return 0;
    let diffM = wakeM - sleepM;
    if (diffM <= 0) diffM += 24 * 60;
    return diffM / 60;
  };

  const getLogAdherenceScore = (log) => {
    const targetM = parseTimeToMinutes(log.target_sleep_time);
    const actualM = parseTimeToMinutes(log.actual_sleep_time);
    if (targetM === null || actualM === null) return 0;
    let diffM = Math.abs(actualM - targetM);
    if (diffM > 12 * 60) diffM = 24 * 60 - diffM;
    const diffH = diffM / 60.0;
    if (diffH <= 0.5) return 20;
    return Math.max(0, 20 - Math.floor((diffH - 0.5) * 5));
  };
  
  // Score Calculations
  const scoreHistory = getFilteredHistory(scoreDays);
  const hasHistory = scoreHistory.length > 0;
  
  const avgWakeUpScore = hasHistory
    ? scoreHistory.reduce((acc, curr) => acc + (curr.wake_up_consistency_score || 0), 0) / scoreHistory.length 
    : (current?.wake_up_consistency_score || 0);

  const avgChallengeRate = hasHistory
    ? scoreHistory.reduce((acc, curr) => acc + (curr.challenge_completion_rate || 0), 0) / scoreHistory.length
    : (current?.challenge_completion_rate || 0);
  
  const avgSnoozeCount = hasHistory
    ? scoreHistory.reduce((acc, curr) => acc + (curr.snooze_count || 0), 0) / scoreHistory.length
    : (current?.snooze_count !== undefined ? current.snooze_count : 0);
    
  const avgSleepScore = hasHistory
    ? scoreHistory.reduce((acc, curr) => acc + (curr.sleep_adherence_score || 0), 0) / scoreHistory.length
    : (current?.sleep_adherence_score || 0);

  // Snooze score follows max(0, 20 - snooze_count * 5).
  // CRITICAL: If no history and no current profile exists, snoozeScore is 0.
  const snoozeScore = (hasHistory || current) 
    ? Math.max(0, Math.round(20 - (avgSnoozeCount * 5))) 
    : 0;

  const totalAvgScore = (hasHistory || current)
    ? Math.min(100, Math.round(avgWakeUpScore) + Math.round(avgChallengeRate * 25) + snoozeScore + Math.round(avgSleepScore))
    : 0;

  
  // Custom Styles
  const ds = {
    grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' },
    card: { backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px', color: 'var(--text-primary)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
    cardTitle: { fontSize: '1.1rem', fontWeight: '600', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' },
    barContainer: { display: 'flex', alignItems: 'flex-end', height: '100px', gap: '8px', marginTop: '20px' },
    bar: { width: '100%', backgroundColor: '#3b82f6', borderRadius: '4px 4px 0 0', minHeight: '10px' },
    trendBadge: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '20px', backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', fontWeight: 'bold' },
    recGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px' },
    recBox: { padding: '15px', borderRadius: '10px', fontSize: '0.85rem' }
  };

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {showDashboard ? "Habit Tracking Dashboard" : "Manage Habits"}
          </h1>
          <p className="text-slate-500 dark:text-[#cbd5e1]">
            {showDashboard ? "Your personalized habit insights powered by AI" : "Create, edit and track all your daily habits"}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => setShowDashboard(!showDashboard)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {showDashboard ? "⚙️ Manage Habits" : "📊 View Dashboard"}
          </button>
        </div>
      </div>

      {showDashboard ? (
        <div className="habit-dashboard fade-in">
          
          <div style={ds.grid}>
            {/* HABIT SCORE */}
            <div style={ds.card}>
              <div style={{ ...ds.cardTitle, justifyContent: 'space-between' }}>
                <span>🏆 Habit Score</span>
                <select value={scoreDays} onChange={(e) => setScoreDays(Number(e.target.value))} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-input)', border: '1px solid #334155', padding: '4px 8px', borderRadius: '4px', outline: 'none', cursor: 'pointer' }}>
                  <option value={7}>Last 7 Days</option>
                  <option value={15}>Last 15 Days</option>
                  <option value={30}>Last 30 Days</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ 
                  width: '100px', height: '100px', borderRadius: '50%', 
                  border: '8px solid #22c55e', display: 'flex', 
                  flexDirection: 'column', alignItems: 'center', justifyContent: 'center' 
                }}>
                  <span style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    {totalAvgScore}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/100</span>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span>Wake-Up Consistency</span>
                      <span>{Math.round(avgWakeUpScore)}/35</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', marginTop: '4px' }}>
                      <div style={{ width: `${(avgWakeUpScore/35)*100}%`, height: '100%', backgroundColor: '#3b82f6', borderRadius: '3px' }}/>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span>Challenge Completion</span>
                      <span>{Math.round(avgChallengeRate * 25)}/25</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', marginTop: '4px' }}>
                      <div style={{ width: `${avgChallengeRate*100}%`, height: '100%', backgroundColor: '#10b981', borderRadius: '3px' }}/>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span>Snooze Reduction</span>
                      <span>{snoozeScore}/20</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', marginTop: '4px' }}>
                      <div style={{ width: `${(snoozeScore / 20) * 100}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: '3px' }}/>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span>Sleep Adherence</span>
                      <span>{Math.round(avgSleepScore)}/20</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', marginTop: '4px' }}>
                      <div style={{ width: `${(avgSleepScore/20)*100}%`, height: '100%', backgroundColor: '#a855f7', borderRadius: '3px' }}/>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BEHAVIOR TREND */}
            <div style={ds.card}>
              <div style={{ ...ds.cardTitle, justifyContent: 'space-between' }}>
                <span>📈 Behavior Trend</span>
                <select value={trendDays} onChange={(e) => setTrendDays(Number(e.target.value))} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-input)', border: '1px solid #334155', padding: '4px 8px', borderRadius: '4px', outline: 'none' }}>
                  <option value={7}>Last 7 Days</option>
                  <option value={15}>Last 15 Days</option>
                  <option value={30}>Last 30 Days</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    ...ds.trendBadge,
                    backgroundColor: (dashboardData?.behavior_trend?.has_sufficient_data === false || dashboardData?.behavior_trend?.trend === 'Insufficient Data')
                      ? 'rgba(100, 116, 139, 0.2)'
                      : dashboardData?.behavior_trend?.trend === 'Improving' ? 'rgba(34, 197, 94, 0.2)'
                      : dashboardData?.behavior_trend?.trend === 'Declining' ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(59, 130, 246, 0.2)',
                    color: (dashboardData?.behavior_trend?.has_sufficient_data === false || dashboardData?.behavior_trend?.trend === 'Insufficient Data')
                      ? '#94a3b8'
                      : dashboardData?.behavior_trend?.trend === 'Improving' ? '#4ade80'
                      : dashboardData?.behavior_trend?.trend === 'Declining' ? '#f87171'
                      : '#60a5fa'
                  }}>
                    {(dashboardData?.behavior_trend?.has_sufficient_data === false || dashboardData?.behavior_trend?.trend === 'Insufficient Data')
                      ? '— Insufficient Data'
                      : dashboardData?.behavior_trend?.trend === 'Improving' ? '↗ Improving'
                      : dashboardData?.behavior_trend?.trend === 'Declining' ? '↘ Declining' : '→ Stable'}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '10px' }}>
                    {(dashboardData?.behavior_trend?.has_sufficient_data === false || dashboardData?.behavior_trend?.trend === 'Insufficient Data')
                      ? 'At least 2 days of wake-up events are required to determine trend.'
                      : `Your wake-up behavior trend over the last ${trendDays} days.`}
                  </p>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ ...ds.barContainer, marginTop: '0', borderLeft: '1px solid #334155', borderBottom: '1px solid #334155', paddingLeft: '5px' }}>
                    {getFilteredHistory(trendDays).length === 0 ? <div style={{width:'100%',textAlign:'center',color:'#64748b',fontSize:'12px',alignSelf:'center'}}>No data</div> : getFilteredHistory(trendDays).map((h, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%' }}>
                        <div style={{ width: '70%', height: `${h.habit_score}%`, backgroundImage: 'linear-gradient(to top, #10b981, #34d399)', borderRadius: '2px 2px 0 0', minHeight: '10px' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', paddingLeft: '5px', marginTop: '5px' }}>
                    {getFilteredHistory(trendDays).map((h, i) => {
                      const d = new Date(h.date);
                      return (
                        <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          {i === 0 || i === getFilteredHistory(trendDays).length - 1 || i % Math.ceil(getFilteredHistory(trendDays).length / 7) === 0 ? d.getDate() : ''}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* CURRENT DIFFICULTY */}
            {(() => {
              const currentDifficulty = dashboardData?.current_difficulty 
                || profile?.difficulty_preference 
                || (alarms.find(a => a.is_active)?.difficulty) 
                || "Beginner";

              const diffColors = {
                Beginner: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '#10b981' },
                Easy: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '#3b82f6' },
                Medium: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '#f59e0b' },
                Hard: { bg: 'rgba(249, 115, 22, 0.1)', color: '#f97316', border: '#f97316' },
                Expert: { bg: 'rgba(225, 29, 72, 0.1)', color: '#f43f5e', border: '#f43f5e' },
              };
              const theme = diffColors[currentDifficulty] || diffColors.Beginner;

              return (
                <div style={ds.card}>
                  <div style={ds.cardTitle}>📊 Current Difficulty</div>
                  <div style={{ backgroundColor: theme.bg, color: theme.color, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '10px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {currentDifficulty}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '15px', textAlign: 'center' }}>
                    Based on your recent cognitive performance & challenges completed.
                  </p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '2px', backgroundColor: 'var(--border)', zIndex: 0 }} />
                    {['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'].map(diff => (
                      <div key={diff} style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <div style={{ 
                          width: '12px', height: '12px', borderRadius: '50%', 
                          backgroundColor: (currentDifficulty === diff) ? theme.color : '#475569',
                          boxShadow: (currentDifficulty === diff) ? `0 0 8px ${theme.color}` : 'none'
                        }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: (currentDifficulty === diff) ? 'bold' : 'normal', color: (currentDifficulty === diff) ? 'var(--text-primary)' : 'var(--text-muted)' }}>{diff}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <div style={ds.grid}>
            {/* WAKE UP STATS */}
             <div style={ds.card}>
              <div style={{ ...ds.cardTitle, justifyContent: 'space-between' }}>
                <span>⏰ Wake-up Statistics</span>
                <select value={statsDays} onChange={(e) => setStatsDays(Number(e.target.value))} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-input)', border: '1px solid #334155', padding: '4px 8px', borderRadius: '4px', outline: 'none', cursor: 'pointer' }}>
                  <option value={7}>Last 7 Days</option>
                  <option value={15}>Last 15 Days</option>
                  <option value={30}>Last 30 Days</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '15px' }}>
                <div style={{ flex: 1, backgroundColor: 'var(--bg-input)', padding: '25px 5px', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#3b82f6' }}>{getFilteredEvents(statsDays).length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>Alarms Rung</div>
                </div>
                <div style={{ flex: 1, backgroundColor: 'var(--bg-input)', padding: '25px 5px', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{getFilteredEvents(statsDays).filter(e => !e.snoozes).length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>Successful Wake-ups</div>
                </div>
                <div style={{ flex: 1, backgroundColor: 'var(--bg-input)', padding: '25px 5px', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#f59e0b' }}>
                    {getFilteredEvents(statsDays).length > 0 ? (getFilteredEvents(statsDays).reduce((acc, e) => acc + (e.snoozes || 0), 0) / getFilteredEvents(statsDays).length).toFixed(1) : 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>Snoozes<br/>(per alarm)</div>
                </div>
                <div style={{ flex: 1, backgroundColor: 'var(--bg-input)', padding: '25px 5px', borderRadius: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#a855f7' }}>
                    {getFilteredEvents(statsDays).length > 0 ? Math.round((getFilteredEvents(statsDays).filter(e => !e.snoozes).length / getFilteredEvents(statsDays).length) * 100) : 0}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>Wake-up Success Rate</div>
                </div>
              </div>
            </div>

            {/* SLEEP ADHERENCE */}
            <div style={ds.card}>
              <div style={{ ...ds.cardTitle, justifyContent: 'space-between' }}>
                <span>🌙 Sleep Adherence</span>
                <select value={sleepDays} onChange={(e) => setSleepDays(Number(e.target.value))} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-input)', border: '1px solid #334155', padding: '4px 8px', borderRadius: '4px', outline: 'none', cursor: 'pointer' }}>
                  <option value={7}>Last 7 Days</option>
                  <option value={15}>Last 15 Days</option>
                  <option value={30}>Last 30 Days</option>
                </select>
              </div>
              {(() => {
                const filteredSleep = getFilteredSleepLogs(sleepDays);
                const hasRealSleepLogs = filteredSleep.length > 0;
                const avgSleepDurationHours = hasRealSleepLogs
                  ? (filteredSleep.reduce((acc, log) => acc + getLogDurationHours(log), 0) / filteredSleep.length)
                  : (getFilteredHistory(sleepDays).length > 0 && avgSleepScore > 0 ? (avgSleepScore * 0.4) : 0);
                const displaySleepHours = Math.floor(avgSleepDurationHours);
                const displaySleepMinutes = Math.round((avgSleepDurationHours - displaySleepHours) * 60);
                const displaySleepAdherencePct = hasRealSleepLogs
                  ? Math.round((filteredSleep.reduce((acc, log) => acc + getLogAdherenceScore(log), 0) / (filteredSleep.length * 20)) * 100)
                  : (avgSleepScore > 0 ? Math.round((avgSleepScore / 20) * 100) : 0);

                return (
                  <>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          {displaySleepHours}h {displaySleepMinutes}m
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Average Sleep Duration</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                          width: '50px', height: '50px', borderRadius: '50%', 
                          border: '5px solid #22c55e', display: 'flex', 
                          alignItems: 'center', justifyContent: 'center' 
                        }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                            {displaySleepAdherencePct}%
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>Schedule Adherence</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', height: '70px', marginTop: '15px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)', paddingRight: '5px', paddingBottom: '15px' }}>
                        <span>12h</span><span>8h</span><span>4h</span><span>0h</span>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', position: 'relative', borderBottom: '1px solid #334155', borderLeft: '1px solid #334155' }}>
                          <div style={{ position: 'absolute', top: '33%', left: '0', right: '0', borderTop: '1px dashed #a855f7', zIndex: 0 }} />
                          <span style={{ position: 'absolute', top: '15%', right: '0', fontSize: '0.65rem', color: 'var(--text-muted)' }}>--- Target (8h)</span>
                          {hasRealSleepLogs ? (
                            filteredSleep.slice(-7).map((s, i) => {
                              const durH = getLogDurationHours(s);
                              return (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%', zIndex: 1 }}>
                                  <div style={{ width: '60%', height: `${Math.min(100, (durH / 12) * 100)}%`, backgroundColor: '#8b5cf6', borderRadius: '2px 2px 0 0', minHeight: '5px' }} title={`${durH.toFixed(1)} hrs`} />
                                </div>
                              );
                            })
                          ) : getFilteredHistory(sleepDays).length === 0 ? (
                            <div style={{width:'100%',textAlign:'center',color:'#64748b',fontSize:'12px',alignSelf:'center'}}>No data</div>
                          ) : (
                            getFilteredHistory(sleepDays).map((h, i) => (
                              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%', zIndex: 1 }}>
                                <div style={{ width: '60%', height: `${((h.sleep_adherence_score * 0.4) / 12) * 100}%`, backgroundColor: '#8b5cf6', borderRadius: '2px 2px 0 0', minHeight: '5px' }} />
                              </div>
                            ))
                          )}
                        </div>
                        <div style={{ display: 'flex', paddingTop: '5px' }}>
                          {hasRealSleepLogs ? (
                            filteredSleep.slice(-7).map((s, i) => {
                              const d = new Date(s.date);
                              return (
                                <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]}
                                </div>
                              );
                            })
                          ) : (
                            getFilteredHistory(sleepDays).map((h, i) => {
                              const d = new Date(h.date);
                              return (
                                <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                  {sleepDays === 7 ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()] : (i === 0 || i === getFilteredHistory(sleepDays).length - 1 || i % Math.ceil(getFilteredHistory(sleepDays).length / 7) === 0 ? d.getDate() : '')}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* CHALLENGE PERFORMANCE */}
            <div style={{ ...ds.card, padding: '15px' }}>
              <div style={{ ...ds.cardTitle, marginBottom: '10px', justifyContent: 'space-between' }}>
                <span>🎯 Challenge Performance</span>
                <select value={perfDays} onChange={(e) => setPerfDays(Number(e.target.value))} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-input)', border: '1px solid #334155', padding: '4px 8px', borderRadius: '4px', outline: 'none', cursor: 'pointer' }}>
                  <option value={7}>Last 7 Days</option>
                  <option value={15}>Last 15 Days</option>
                  <option value={30}>Last 30 Days</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {cognitiveStats && cognitiveStats.type_stats ? (
                  Object.entries(cognitiveStats.type_stats).map(([name, data], i) => {
                    const val = Math.round(data.success_rate);
                    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ec4899", "#facc15", "#06b6d4"];
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem' }}>
                        <div style={{ width: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                        <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', margin: '0 10px' }}>
                          <div style={{ width: `${val}%`, height: '100%', backgroundColor: colors[i % colors.length], borderRadius: '4px' }} />
                        </div>
                        <div style={{ width: '30px', textAlign: 'right' }}>{val}%</div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                    No challenge data available yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* ALARM HISTORY */}
            <div style={{ ...ds.card, overflowY: 'auto', maxHeight: '250px' }}>
              <div style={{ ...ds.cardTitle, justifyContent: 'space-between' }}>
                <span>📅 Alarm History</span>
              </div>
              <table style={{ width: '100%', fontSize: '0.85rem', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid #334155' }}>
                    <th style={{ padding: '8px 0' }}>Date</th>
                    <th>Alarm Time</th>
                    <th>Wake-Up Time</th>
                    <th>Snoozes</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e, i) => {
                    const alarm = alarms.find(a => a.id === e.alarm_id);
                    const alarmTimeStr = alarm?.time ? (() => {
                      const [h, m] = alarm.time.split(':');
                      const d = new Date(); d.setHours(parseInt(h), parseInt(m));
                      return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    })() : '--';
                    
                    return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '10px 0' }}>{new Date(e.started_at).toLocaleDateString()}</td>
                      <td>{alarmTimeStr}</td>
                      <td>{new Date(e.started_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      <td>{e.snoozes || 0}</td>
                      <td>
                        {e.snoozes > 0 ? (
                          <span style={{ color: '#f43f5e' }}>✖ Missed</span>
                        ) : (
                          <span style={{ color: '#10b981' }}>✓ Success</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                  {events.length === 0 && (
                    <tr><td colSpan="5" style={{ padding: '15px 0', textAlign: 'center', color: '#64748b' }}>No recent wake-up events.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* DIFFICULTY PROGRESSION */}
            <div style={ds.card}>
              <div style={ds.cardTitle}>📈 Difficulty Progression</div>
              <div style={{ position: 'relative', height: '150px', marginTop: '20px' }}>
                <svg width="100%" height="100%" viewBox="0 0 400 150" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  {[10, 40, 70, 100, 130].map((y, i) => (
                    <g key={y}>
                      <text x="50" y={y+4} fill="#94a3b8" fontSize="12" textAnchor="end">
                        {['Expert', 'Hard', 'Medium', 'Easy', 'Beginner'][i]}
                      </text>
                      <line x1="60" y1={y} x2="380" y2={y} stroke="#334155" strokeDasharray="4 4" />
                    </g>
                  ))}
                                 {(() => {
                    const diffMap = { 'Expert': 10, 'Hard': 40, 'Medium': 70, 'Easy': 100, 'Beginner': 130 };
                    const currentDiffStr = dashboardData?.current_difficulty 
                      || profile?.difficulty_preference 
                      || (alarms.find(a => a.is_active)?.difficulty) 
                      || "Beginner";
                    const currentY = diffMap[currentDiffStr] || 130;
                    
                    // Progressive curve based on current difficulty tier
                    let y1 = 130, y2 = 130, y3 = 130, y4 = currentY;
                    if (currentDiffStr === 'Easy') {
                      y1 = 130; y2 = 130; y3 = 100; y4 = 100;
                    } else if (currentDiffStr === 'Medium') {
                      y1 = 130; y2 = 100; y3 = 85; y4 = 70;
                    } else if (currentDiffStr === 'Hard') {
                      y1 = 130; y2 = 100; y3 = 70; y4 = 40;
                    } else if (currentDiffStr === 'Expert') {
                      y1 = 130; y2 = 100; y3 = 55; y4 = 10;
                    }

                    return (
                      <>
                        <polyline 
                          points={`80,${y1} 180,${y2} 280,${y3} 380,${y4}`} 
                          fill="none" stroke="#3b82f6" strokeWidth="3" 
                        />
                        <circle cx="80" cy={y1} r="5" fill="#3b82f6" />
                        <circle cx="180" cy={y2} r="5" fill="#a855f7" />
                        <circle cx="280" cy={y3} r="5" fill="#ec4899" />
                        
                        <circle cx="380" cy={y4} r="7" fill="#f43f5e" />
                        <circle cx="380" cy={y4} r="14" fill="rgba(244, 63, 94, 0.3)" />
                        <text x="380" y={y4 - 15} fill="#f8fafc" fontSize="12" textAnchor="middle" fontWeight="bold">Current ({currentDiffStr})</text>
                      </>
                    );
                  })()}

                  {/* X Axis */}
                  <text x="80" y="150" fill="#94a3b8" fontSize="10" textAnchor="middle">Week 1</text>
                  <text x="180" y="150" fill="#94a3b8" fontSize="10" textAnchor="middle">Week 2</text>
                  <text x="280" y="150" fill="#94a3b8" fontSize="10" textAnchor="middle">Week 3</text>
                  <text x="380" y="150" fill="#94a3b8" fontSize="10" textAnchor="middle">Week 4</text>
                </svg>
              </div>
            </div>
          </div>

          {/* RECOMMENDATIONS */}
          {recommendations && (
            <div style={{ ...ds.card, marginBottom: '20px' }}>
              <div style={ds.cardTitle}>💡 Personalized Recommendations</div>
              <div style={ds.recGrid}>
                <div style={{ ...ds.recBox, backgroundColor: 'rgba(139, 92, 246, 0.2)', border: '1px solid #8b5cf6' }}>
                  <h4 style={{ color: '#c4b5fd', margin: '0 0 8px 0' }}>💤 Sleep Improvement</h4>
                  <p style={{ margin: 0, color: 'var(--text-primary)' }}>{recommendations.sleep_improvement || "No sleep logs recorded for this period. Log your bedtime and wake-up times to receive personalized sleep insights."}</p>
                </div>
                <div style={{ ...ds.recBox, backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6' }}>
                  <h4 style={{ color: '#93c5fd', margin: '0 0 8px 0' }}>⏰ Wake-Up Optimization</h4>
                  <p style={{ margin: 0, color: 'var(--text-primary)' }}>{recommendations.wake_up_optimization || "Reduce morning snoozing."}</p>
                </div>
                <div style={{ ...ds.recBox, backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981' }}>
                  <h4 style={{ color: '#6ee7b7', margin: '0 0 8px 0' }}>🎯 Habit Improvement</h4>
                  <p style={{ margin: 0, color: 'var(--text-primary)' }}>{recommendations.habit_improvement || "Focus on maintaining your routine."}</p>
                </div>
                <div style={{ ...ds.recBox, backgroundColor: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b' }}>
                  <h4 style={{ color: '#fcd34d', margin: '0 0 8px 0' }}>📈 Productivity</h4>
                  <p style={{ margin: 0, color: 'var(--text-primary)' }}>{recommendations.productivity || "Build your morning momentum."}</p>
                </div>
                <div style={{ ...ds.recBox, backgroundColor: 'rgba(236, 72, 153, 0.2)', border: '1px solid #ec4899' }}>
                  <h4 style={{ color: '#f9a8d4', margin: '0 0 8px 0' }}>🧠 Personalized Challenge</h4>
                  <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 'bold' }}>{recommendations.personalized_challenge || "Recommended: Pattern Recognition"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="habit-manager fade-in">
          <div className="search-bar">
            <div className="search-input-wrapper">
              <span className="search-input-icon">🔍</span>
              <input type="search" placeholder="Search habits..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="All">All Status</option><option value="Completed">Completed</option><option value="Pending">Pending</option>
            </select>
            <Link to="/add-habit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>+ Add Habit</Link>
          </div>
          <div className="card">
            <div className="card-header"><h3>All Habits ({filtered.length})</h3></div>
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No habits found</div>
                <div className="empty-state-desc">{habits.length === 0 ? "Create your first habit to get started!" : "Try adjusting your filters."}</div>
              </div>
            ) : (
              <div className="habit-list">
                {filtered.map((habit) => {
                  const progress = habit.completed ? 100 : 0;
                  return (
                    <div key={habit.id} className={`habit-card-item habit-card-rich ${habit.completed ? "completed" : ""}`}>
                      <button className={`habit-check ${habit.completed ? "checked" : ""}`} onClick={() => toggleHabit(habit.id)}>{habit.completed ? "✓" : ""}</button>
                      <div className="habit-card-info habit-card-content">
                        <div className="habit-card-name">{habit.name}</div>
                        {habit.description && <p className="habit-description">{habit.description}</p>}
                        <div className="habit-card-meta habit-badges">
                          <span className="tag tag-primary">{habit.category}</span>
                          <span className="tag tag-outline">{habit.frequency}</span>
                          <span className="tag tag-outline">{habit.target_duration_minutes} min</span>
                          <span className="tag tag-outline">{habit.priority || "Medium"}</span>
                        </div>
                        {habit.goal_target && <div className="habit-detail-line">🎯 <strong>Goal:</strong> {habit.goal_target}</div>}
                        {habit.reminder_time && <div className="habit-detail-line">⏰ <strong>Reminder:</strong> {habit.reminder_time}</div>}
                        {(habit.start_date || habit.target_date) && <div className="habit-detail-line">📅 {formatDate(habit.start_date) || "Start not set"} → {formatDate(habit.target_date) || "No target date"}</div>}
                        <div className="habit-progress" aria-label={`Progress: ${progress}%`}>
                          <div className="habit-progress-header"><span>{progress}%</span><span>{habit.completed ? "1 / 1 completion recorded" : "0 / 1 completion recorded"}</span></div>
                          <div className="habit-progress-track"><div className="habit-progress-fill" style={{ width: `${progress}%` }} /></div>
                        </div>
                      </div>
                      <div className="habit-card-actions">
                        <button className="btn btn-ghost btn-icon" onClick={() => navigate(`/add-habit?edit=${habit.id}`)} title="Edit">✏️</button>
                        <button className="btn btn-ghost btn-icon" onClick={() => deleteHabit(habit.id)} title="Delete">🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
