import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { 
  Target, AlarmClock, BrainCircuit, BarChart2,
  TrendingUp, CheckCircle, Clock, Calendar, 
  Activity, Plus, Play, ChevronRight, Settings, Users,
  ListTodo
} from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip, Cell } from "recharts";

import API_URL from "../../config/api";

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const token = localStorage.getItem("access_token");
  
  const [alarms, setAlarms] = useState([]);
  const [habits, setHabits] = useState([]);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    async function load() {
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      
      const safeFetch = async (url, setter) => {
        try {
          const res = await fetch(url, { headers });
          if (res.ok) {
            const data = await res.json();
            setter(data);
          }
        } catch (e) {
          console.error(`Error loading ${url}:`, e);
        }
      };

      await Promise.allSettled([
        safeFetch(`${API_URL}/alarms`, setAlarms),
        safeFetch(`${API_URL}/habits`, setHabits),
        safeFetch(`${API_URL}/profile`, setProfile),
        safeFetch(`${API_URL}/challenges/analytics/stats`, setStats),
        safeFetch(`${API_URL}/challenges/history/all`, setHistory),
      ]);
    }
    load();
  }, [token]);

  async function toggleHabit(id) {
    try {
      await fetch(`${API_URL}/habits/${id}/toggle`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
      const habitRes = await fetch(`${API_URL}/habits`, { headers: { Authorization: `Bearer ${token}` } });
      if (habitRes.ok) setHabits(await habitRes.json());
    } catch (err) { console.error(err); }
  }

  const completed = habits.filter((h) => h.completed);
  const pending = habits.filter((h) => !h.completed);
  const activeAlarms = alarms.filter((a) => a.is_active);
  const completionRate = habits.length > 0 ? Math.round((completed.length / habits.length) * 100) : 0;

  const chartData = stats?.type_stats ? Object.entries(stats.type_stats).map(([name, data]) => ({
    name: name.split(' ')[0],
    rate: Math.round(data.success_rate)
  })) : [];

  // Dynamic data for UI elements
  const recentActivity = [
    ...completed.map(h => ({
      type: 'habit', text: `Completed habit "${h.name}"`, time: 'Today', icon: CheckCircle, color: 'text-[#10b981]'
    })),
    ...history.slice(0, 5).map(c => ({
      type: 'challenge', text: `Solved challenge ${c.challenge_type}`, time: new Date(c.created_at).toLocaleDateString(), icon: BrainCircuit, color: 'text-[#8b5cf6]'
    }))
  ].slice(0, 5);

  const todaySchedule = activeAlarms.map(a => ({
    id: a.id,
    time: a.time,
    title: a.title,
    challenge: a.challenge_type,
    difficulty: a.difficulty || "Beginner",
    status: 'Scheduled',
    statusColor: 'text-slate-600 dark:text-[#cbd5e1] bg-slate-200 dark:bg-[#334155]/50 border-slate-200 dark:border-[#334155]'
  })).sort((a, b) => a.time.localeCompare(b.time));
  
  if (todaySchedule.length > 0) {
    todaySchedule[0].status = 'Next';
    todaySchedule[0].statusColor = 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20';
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 pb-10">
        
        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              Good Morning, {user.name?.split(' ')[0] || "Gagandeep"}! <span className="text-4xl">👋</span>
            </h1>
            <p className="text-slate-500 dark:text-[#94a3b8]">Rise. Solve. Stay Productive!</p>
          </div>
          <div className="bg-gradient-to-r from-[#6366f1]/20 to-[#8b5cf6]/20 border border-[#6366f1]/30 rounded-xl p-4 hidden md:flex items-center gap-4 max-w-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#8b5cf6]/20 blur-2xl rounded-full"></div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white italic">"Small steps every morning create a better you."</p>
            </div>
          </div>
        </div>

        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#283548] transition-colors relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#6366f1]/10">
                <Target className="w-6 h-6 text-[#6366f1]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{habits.length}</div>
                <div className="text-sm text-slate-500 dark:text-[#94a3b8]">Total Habits</div>
                <div className="text-xs text-[#64748b] mt-0.5">Keep going!</div>
              </div>
            </div>
            <div className="flex flex-col items-end text-[#10b981]">
              <TrendingUp className="w-4 h-4 mb-1" />
              <span className="text-xs font-semibold">+ 50%</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#283548] transition-colors relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#f59e0b]/10">
                <AlarmClock className="w-6 h-6 text-[#f59e0b]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{activeAlarms.length}</div>
                <div className="text-sm text-slate-500 dark:text-[#94a3b8]">Active Alarms</div>
                <div className="text-xs text-[#64748b] mt-0.5">1 pending</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#283548] transition-colors relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#ec4899]/10">
                <BrainCircuit className="w-6 h-6 text-[#ec4899]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats?.completed || 0}</div>
                <div className="text-sm text-slate-500 dark:text-[#94a3b8]">Challenges Solved</div>
                <div className="text-xs text-[#64748b] mt-0.5">This week</div>
              </div>
            </div>
            <div className="flex flex-col items-end text-[#10b981]">
              <TrendingUp className="w-4 h-4 mb-1" />
              <span className="text-xs font-semibold">+ 100%</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#283548] transition-colors relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#10b981]/10">
                <BarChart2 className="w-6 h-6 text-[#10b981]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{completionRate}%</div>
                <div className="text-sm text-slate-500 dark:text-[#94a3b8]">Overall Progress</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Next Alarm & Wake-up Challenge */}
          <div className="bg-gradient-to-br from-white dark:from-[#1e293b] to-slate-50 dark:to-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-xl p-4 relative overflow-hidden flex flex-col justify-center">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#6366f1]/10 blur-3xl rounded-full"></div>
            
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><AlarmClock className="w-4 h-4 text-[#6366f1]"/> Next Alarm & Wake-up Challenge</h3>
              <div className="text-xs text-slate-600 dark:text-[#cbd5e1] flex items-center gap-1.5 bg-slate-200 dark:bg-[#334155]/50 px-2 py-1 rounded-md border border-slate-200 dark:border-[#334155]">
                <Clock className="w-3 h-3"/> {todaySchedule.length > 0 ? "Upcoming" : "No Alarms"}
              </div>
            </div>

            {todaySchedule.length > 0 ? (
            <div className="flex flex-col md:flex-row gap-4 items-center z-10">
               <div className="flex-1 text-center md:text-left">
                  <div className="text-4xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">{todaySchedule[0].time}</div>
                  <div className="text-base font-medium text-slate-600 dark:text-[#cbd5e1] mb-1">{todaySchedule[0].title}</div>
                  <div className="text-xs text-slate-500 dark:text-[#94a3b8] mb-3">Scheduled</div>
                  <span className="inline-block text-xs font-medium px-2.5 py-1 rounded bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">Active</span>
               </div>
               
               <div className="flex-1 bg-white dark:bg-[#1e293b]/80 backdrop-blur border border-slate-200 dark:border-[#334155] rounded-xl p-4 w-full">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                     <BrainCircuit className="w-5 h-5 text-[#8b5cf6]" />
                     <span className="font-semibold text-slate-900 dark:text-white">Wake-up Challenge</span>
                  </div>
                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between items-center text-sm">
                       <span className="text-slate-500 dark:text-[#94a3b8]">Challenge Type</span>
                       <span className="text-slate-600 dark:text-[#cbd5e1] font-medium bg-slate-200 dark:bg-[#334155]/50 px-2 py-0.5 rounded border border-slate-200 dark:border-[#334155]">{todaySchedule[0].challenge}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                       <span className="text-slate-500 dark:text-[#94a3b8]">Difficulty</span>
                       <span className={`font-semibold px-2 py-0.5 rounded border text-xs uppercase tracking-wider ${
                         (todaySchedule[0].difficulty || "Beginner") === "Beginner"
                           ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                           : (todaySchedule[0].difficulty || "Beginner") === "Easy"
                           ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                           : (todaySchedule[0].difficulty || "Beginner") === "Medium"
                           ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                           : (todaySchedule[0].difficulty || "Beginner") === "Hard"
                           ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                           : "bg-purple-500/10 text-purple-500 border-purple-500/20"
                       }`}>
                         ⚡ {todaySchedule[0].difficulty || "Beginner"}
                       </span>
                    </div>
                  </div>
                  <p className="text-xs text-center text-slate-500 dark:text-[#94a3b8] mb-3">Practice before the alarm rings!</p>
                  <button className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-slate-900 dark:text-white py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.5)] border-0 hover:scale-[1.02]" onClick={() => navigate('/wake-up-challenge', { state: { alarmId: todaySchedule[0].id } })}>
                    <Play className="w-5 h-5" /> Practice Challenge
                  </button>
               </div>
            </div>
            ) : (
            <div className="flex flex-col items-center justify-center py-10 z-10">
               <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-[#334155]/30 flex items-center justify-center mb-4">
                 <AlarmClock className="w-8 h-8 text-slate-400 dark:text-[#64748b]" />
               </div>
               <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No Alarms Set</h4>
               <p className="text-sm text-slate-500 dark:text-[#94a3b8] text-center max-w-xs mb-6">You don't have any active alarms for today. Set one up to start your cognitive morning routine!</p>
               <button className="bg-[#6366f1] hover:bg-[#4f46e5] text-slate-900 dark:text-white px-6 py-2.5 rounded-xl font-semibold transition-colors shadow-lg shadow-[#6366f1]/25" onClick={() => navigate('/reminders')}>
                 Create Alarm
               </button>
            </div>
            )}
          </div>

          {/* Your Habits */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><ListTodo className="w-4 h-4 text-[#10b981]"/> Your Habits</h3>
              <button className="text-xs text-[#6366f1] hover:underline" onClick={() => navigate("/habits")}>View All</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {habits.slice(0, 5).map((h) => {
                const progress = h.completed ? 100 : 0;
                return (
                <div key={h.id} className="flex gap-4 items-start p-3 rounded-lg border border-slate-200 dark:border-[#334155]/50 bg-slate-200 dark:bg-[#334155]/20 hover:bg-slate-200 dark:bg-[#334155]/40 transition-colors">
                  <div 
                    onClick={() => toggleHabit(h.id)}
                    className={`mt-1 w-5 h-5 rounded flex items-center justify-center border transition-colors cursor-pointer ${h.completed ? 'bg-[#10b981] border-[#10b981]' : 'border-[#64748b]'}`}
                  >
                    {h.completed && <CheckCircle className="w-3.5 h-3.5 text-slate-900 dark:text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`font-medium text-sm ${h.completed ? 'text-slate-500 dark:text-[#94a3b8] line-through' : 'text-slate-900 dark:text-white'}`}>{h.name}</span>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">{progress}%<br/><span className="text-[10px] text-[#64748b] font-normal">{h.completed ? 1 : 0}/1</span></span>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#6366f1]/20 text-[#6366f1] border border-[#6366f1]/30">{h.category?.toUpperCase() || 'GENERAL'}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#334155] text-slate-600 dark:text-[#cbd5e1] border border-[#475569]">{h.frequency?.toUpperCase() || 'DAILY'}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#334155] text-slate-600 dark:text-[#cbd5e1] border border-[#475569]">{h.target_duration_minutes || 15} MIN</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-[#334155] rounded-full overflow-hidden">
                      <div className="h-full bg-[#10b981] rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                </div>
              )})}
            </div>

            <button className="mt-4 w-full bg-[#6366f1]/20 hover:bg-[#6366f1]/30 text-[#6366f1] border border-[#6366f1]/30 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors" onClick={() => navigate("/add-habit")}>
              <Plus className="w-4 h-4" /> Add New Habit
            </button>
          </div>
        </div>

        {/* Main Grid Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          <div className="flex flex-col gap-5">
            {/* Today's Schedule */}
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Calendar className="w-4 h-4 text-[#ec4899]"/> Today's Schedule</h3>
                <button className="text-xs text-[#6366f1] hover:underline" onClick={() => navigate("/reminders")}>View All</button>
              </div>
              <div className="space-y-3">
                 {todaySchedule.map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-slate-200 dark:bg-[#334155]/20 border border-slate-200 dark:border-[#334155]/50">
                       <div className="text-xs font-semibold text-slate-600 dark:text-[#cbd5e1] w-16">{item.time}</div>
                       <div className="w-8 h-8 rounded-full bg-[#ef4444]/10 flex items-center justify-center">
                          <AlarmClock className="w-4 h-4 text-[#ef4444]" />
                       </div>
                       <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{item.title}</p>
                       </div>
                       <div className="hidden sm:flex items-center gap-2 bg-[#8b5cf6]/10 px-2 py-1 rounded border border-[#8b5cf6]/20">
                          <BrainCircuit className="w-3 h-3 text-[#8b5cf6]" />
                          <span className="text-[10px] text-[#8b5cf6] font-medium">{item.challenge}</span>
                       </div>
                       <div className={`text-[10px] px-2 py-1 rounded font-medium border ${item.statusColor}`}>
                          {item.status}
                       </div>
                       <button className="text-[#64748b] hover:text-slate-900 dark:text-white"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                 ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex-1">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Activity className="w-4 h-4 text-[#06b6d4]"/> Recent Activity</h3>
                <button className="text-xs text-[#6366f1] hover:underline">View All</button>
              </div>
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#334155] before:to-transparent">
                 {recentActivity.map((act, i) => (
                    <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                       {/* Icon */}
                       <div className="flex items-center justify-center w-6 h-6 rounded-full border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1e293b] group-[.is-active]:bg-white dark:bg-[#1e293b] text-slate-500 group-[.is-active]:text-emerald-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          <act.icon className={`w-3 h-3 ${act.color}`} />
                       </div>
                       {/* Content */}
                       <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-slate-200 dark:bg-[#334155]/20 p-3 rounded-lg border border-slate-200 dark:border-[#334155]/50">
                          <div className="flex items-center justify-between mb-1">
                             <div className="text-xs font-medium text-slate-900 dark:text-white">{act.text}</div>
                             <div className="text-[10px] text-[#64748b]">{act.time}</div>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {/* Challenge Performance Mini-Dashboard */}
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5">
               <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6"><BarChart2 className="w-4 h-4 text-[#8b5cf6]"/> Challenge Performance (This Week)</h3>
               <div className="flex flex-col gap-4">
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-slate-200 dark:bg-[#334155]/30">
                       <Target className="w-5 h-5 text-[#10b981] mb-2" />
                       <span className="text-xl font-bold text-slate-900 dark:text-white mb-1">{stats?.success_rate ? stats.success_rate.toFixed(0) : 0}%</span>
                       <span className="text-[10px] text-slate-500 dark:text-[#94a3b8]">Success Rate</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-slate-200 dark:bg-[#334155]/30">
                       <BarChart2 className="w-5 h-5 text-[#6366f1] mb-2" />
                       <span className="text-xl font-bold text-slate-900 dark:text-white mb-1">{stats?.average_score ? stats.average_score.toFixed(0) : 0}</span>
                       <span className="text-[10px] text-slate-500 dark:text-[#94a3b8]">Average Score</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-slate-200 dark:bg-[#334155]/30">
                       <Clock className="w-5 h-5 text-[#f59e0b] mb-2" />
                       <span className="text-xl font-bold text-slate-900 dark:text-white mb-1">{stats?.average_solve_time ? stats.average_solve_time.toFixed(1) : '0'}s</span>
                       <span className="text-[10px] text-slate-500 dark:text-[#94a3b8]">Avg. Solve Time</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-slate-200 dark:bg-[#334155]/30">
                       <BrainCircuit className="w-5 h-5 text-[#eab308] mb-2" />
                       <span className="text-xl font-bold text-slate-900 dark:text-white mb-1">{stats?.completed || 0}</span>
                       <span className="text-[10px] text-slate-500 dark:text-[#94a3b8]">Challenges Solved</span>
                    </div>
                 </div>

                 {chartData.length > 0 && (
                   <div className="h-32 w-full mt-2">
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                         <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                         <Tooltip cursor={{ fill: 'var(--border)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-primary)' }} />
                         <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                           {chartData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.rate >= 80 ? '#10b981' : entry.rate >= 50 ? '#f59e0b' : '#ef4444'} />
                           ))}
                         </Bar>
                       </BarChart>
                     </ResponsiveContainer>
                   </div>
                 )}
               </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex-1">
               <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-[#f59e0b]"/> Quick Actions</h3>
               <div className="grid grid-cols-2 gap-3">
                  <button className="flex items-center gap-3 p-3 rounded-lg bg-slate-200 dark:bg-[#334155]/30 hover:bg-slate-200 dark:bg-[#334155]/60 transition-colors border border-slate-200 dark:border-[#334155]/50 group" onClick={() => navigate('/reminders')}>
                     <div className="w-8 h-8 rounded bg-[#f59e0b]/10 flex items-center justify-center">
                        <AlarmClock className="w-4 h-4 text-[#f59e0b]" />
                     </div>
                     <span className="text-sm text-slate-600 dark:text-[#cbd5e1] group-hover:text-slate-900 dark:text-white font-medium">Set New Alarm</span>
                  </button>
                  <button className="flex items-center gap-3 p-3 rounded-lg bg-slate-200 dark:bg-[#334155]/30 hover:bg-slate-200 dark:bg-[#334155]/60 transition-colors border border-slate-200 dark:border-[#334155]/50 group" onClick={() => navigate('/wake-up-challenge')}>
                     <div className="w-8 h-8 rounded bg-[#ec4899]/10 flex items-center justify-center">
                        <BrainCircuit className="w-4 h-4 text-[#ec4899]" />
                     </div>
                     <span className="text-sm text-slate-600 dark:text-[#cbd5e1] group-hover:text-slate-900 dark:text-white font-medium">Take a Challenge</span>
                  </button>
                  <button className="flex items-center gap-3 p-3 rounded-lg bg-slate-200 dark:bg-[#334155]/30 hover:bg-slate-200 dark:bg-[#334155]/60 transition-colors border border-slate-200 dark:border-[#334155]/50 group" onClick={() => navigate('/challenge-history')}>
                     <div className="w-8 h-8 rounded bg-[#cbd5e1]/10 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-slate-600 dark:text-[#cbd5e1]" />
                     </div>
                     <span className="text-sm text-slate-600 dark:text-[#cbd5e1] group-hover:text-slate-900 dark:text-white font-medium">View History</span>
                  </button>
                  <button className="flex items-center gap-3 p-3 rounded-lg bg-slate-200 dark:bg-[#334155]/30 hover:bg-slate-200 dark:bg-[#334155]/60 transition-colors border border-slate-200 dark:border-[#334155]/50 group" onClick={() => navigate('/cognitive-analytics')}>
                     <div className="w-8 h-8 rounded bg-[#10b981]/10 flex items-center justify-center">
                        <BarChart2 className="w-4 h-4 text-[#10b981]" />
                     </div>
                     <span className="text-sm text-slate-600 dark:text-[#cbd5e1] group-hover:text-slate-900 dark:text-white font-medium">View Analytics</span>
                  </button>
                  <button className="flex items-center gap-3 p-3 rounded-lg bg-slate-200 dark:bg-[#334155]/30 hover:bg-slate-200 dark:bg-[#334155]/60 transition-colors border border-slate-200 dark:border-[#334155]/50 group" onClick={() => navigate('/habits')}>
                     <div className="w-8 h-8 rounded bg-[#8b5cf6]/10 flex items-center justify-center">
                        <ListTodo className="w-4 h-4 text-[#8b5cf6]" />
                     </div>
                     <span className="text-sm text-slate-600 dark:text-[#cbd5e1] group-hover:text-slate-900 dark:text-white font-medium">Manage Habits</span>
                  </button>
                  <button className="flex items-center gap-3 p-3 rounded-lg bg-slate-200 dark:bg-[#334155]/30 hover:bg-slate-200 dark:bg-[#334155]/60 transition-colors border border-slate-200 dark:border-[#334155]/50 group" onClick={() => navigate('/profile')}>
                     <div className="w-8 h-8 rounded bg-[#6366f1]/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-[#6366f1]" />
                     </div>
                     <span className="text-sm text-slate-600 dark:text-[#cbd5e1] group-hover:text-slate-900 dark:text-white font-medium">Edit Profile</span>
                  </button>
               </div>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
