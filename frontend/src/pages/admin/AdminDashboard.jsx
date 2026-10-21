import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { 
  Users, UserCheck, AlarmClock, BrainCircuit, 
  TrendingUp, Activity, CheckCircle, XCircle, 
  Clock, Server, Shield, FileText, Megaphone, Plus, Target
} from "lucide-react";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

import API_URL from "../../config/api";

// --- Dynamic Chart Data computed inside component ---
// Custom Tooltip for dark theme
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] p-3 rounded-lg shadow-xl">
        <p className="text-slate-600 dark:text-[#cbd5e1] mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="font-semibold text-sm">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");
  const [stats, setStats] = useState({ total_users: 0, total_alarms: 0, total_challenges: 0, challenge_success_rate: 0, platform_health_score: 0, avg_cognitive_score: 0, avg_solve_time: 0 });
  const [users, setUsers] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [alarms, setAlarms] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, usersRes, challengesRes, alarmsRes] = await Promise.all([
          fetch(`${API_URL}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/admin/challenges`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/admin/alarms`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (statsRes.ok) {
          const s = await statsRes.json();
          setStats({
            total_users: s.total_users || 0,
            total_alarms: s.total_alarms || 0,
            total_challenges: s.total_challenges || 0,
            challenge_success_rate: s.challenge_success_rate || 0,
            platform_health_score: s.platform_health_score || 0,
            avg_cognitive_score: s.avg_cognitive_score || 0,
            avg_solve_time: s.avg_solve_time || 0
          });
        }
        if (usersRes.ok) {
           const uData = await usersRes.json();
           setUsers(Array.isArray(uData) ? uData : []);
        }
        if (challengesRes.ok) {
           setChallenges(await challengesRes.json());
        }
        if (alarmsRes.ok) {
           setAlarms(await alarmsRes.json());
        }
      } catch (err) { console.error(err); setUsers([]); }
    }
    if (token) load();
  }, [token]);

  // Dynamic Chart Data Computations
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const userGrowthMap = {};
  users.forEach(u => {
    const d = new Date(u.created_at);
    if (!isNaN(d)) {
      const dayName = days[d.getDay()];
      userGrowthMap[dayName] = (userGrowthMap[dayName] || 0) + 1;
    }
  });
  const userGrowthData = days.map(d => ({ name: d, users: userGrowthMap[d] || 0 }));

  const challengeTypes = {};
  challenges.forEach(c => {
    challengeTypes[c.challenge_type] = (challengeTypes[c.challenge_type] || 0) + 1;
  });
  const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
  const challengeDistData = Object.keys(challengeTypes).map((key, i) => ({
    name: key,
    value: challenges.length > 0 ? Math.round((challengeTypes[key] / challenges.length) * 100) : 0,
    color: colors[i % colors.length]
  }));
  if (challengeDistData.length === 0) {
     challengeDistData.push({ name: 'No Data', value: 100, color: '#64748b' });
  }

  const activityMap = {};
  days.forEach(d => activityMap[d] = { name: d, alarms: 0, challenges: 0 });
  alarms.forEach(a => {
    const d = new Date(a.created_at);
    if (!isNaN(d)) activityMap[days[d.getDay()]].alarms++;
  });
  challenges.forEach(c => {
    const d = new Date(c.created_at);
    if (!isNaN(d)) activityMap[days[d.getDay()]].challenges++;
  });
  const platformActivityData = days.map(d => activityMap[d]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 pb-10">
        
        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              Welcome, Admin! <span className="text-2xl">👋</span>
            </h1>
            <p className="text-slate-500 dark:text-[#94a3b8]">Monitor. Manage. Ensure smooth operations.</p>
          </div>
          <div className="bg-gradient-to-r from-[#6366f1]/20 to-[#8b5cf6]/20 border border-[#6366f1]/30 rounded-xl p-4 hidden md:flex items-center gap-4 max-w-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#8b5cf6]/20 blur-2xl rounded-full"></div>
            <TrendingUp className="text-[#8b5cf6] w-8 h-8" />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white italic">"A more productive world starts with better mornings."</p>
            </div>
            <button className="absolute top-2 right-2 text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:text-white"><XCircle className="w-4 h-4"/></button>
          </div>
        </div>

        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[
            { label: 'Total Users', value: stats.total_users, change: '+ 12%', icon: Users, color: 'text-[#6366f1]', bg: 'bg-[#6366f1]/10', trend: 'text-[#10b981]' },
            { label: 'Platform Health', value: `${stats.platform_health_score}/100`, sub: 'Engagement + Success Rates', change: '+ 5%', icon: Activity, color: 'text-[#10b981]', bg: 'bg-[#10b981]/10', trend: 'text-[#10b981]' },
            { label: 'Total Alarms', value: stats.total_alarms, sub: 'Today: 428', change: '+ 15%', icon: AlarmClock, color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10', trend: 'text-[#10b981]' },
            { label: 'Challenges Solved', value: stats.total_challenges, sub: `Success Rate: ${stats.challenge_success_rate}%`, change: '+ 20%', icon: BrainCircuit, color: 'text-[#8b5cf6]', bg: 'bg-[#8b5cf6]/10', trend: 'text-[#10b981]' },
            { label: 'Avg. Cognitive Score', value: stats.avg_cognitive_score || '0', sub: 'Global Average', change: '+ 3%', icon: Target, color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10', trend: 'text-[#10b981]' },
            { label: 'Avg. Solve Time', value: `${stats.avg_solve_time || 0}s`, sub: 'Global Average', change: '- 2%', icon: Clock, color: 'text-[#0ea5e9]', bg: 'bg-[#0ea5e9]/10', trend: 'text-[#10b981]' },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#283548] transition-colors relative overflow-hidden">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value.toLocaleString()}</div>
                  <div className="text-sm text-slate-500 dark:text-[#94a3b8]">{stat.label}</div>
                  {stat.sub && <div className="text-xs text-[#64748b] mt-0.5">{stat.sub}</div>}
                </div>
              </div>
              <div className={`flex flex-col items-end ${stat.trend}`}>
                <TrendingUp className="w-4 h-4 mb-1" />
                <span className="text-xs font-semibold">{stat.change}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Growth */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Users className="w-4 h-4 text-[#6366f1]"/> User Growth</h3>
              <select className="bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded px-2 py-1 text-xs text-slate-600 dark:text-[#cbd5e1] outline-none">
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
              </select>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userGrowthData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="users" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Challenge Distribution */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 lg:col-span-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><BrainCircuit className="w-4 h-4 text-[#06b6d4]"/> Challenge Type Distribution</h3>
            <div className="flex items-center justify-center h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={challengeDistData} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value"
                  >
                    {challengeDistData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total_challenges.toLocaleString()}</span>
                <span className="text-[10px] text-slate-500 dark:text-[#94a3b8]">Total</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
              {challengeDistData.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-[#cbd5e1]">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                    {item.name}
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-white">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Platform Activity */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Activity className="w-4 h-4 text-[#10b981]"/> Platform Activity</h3>
              <select className="bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded px-2 py-1 text-xs text-slate-600 dark:text-[#cbd5e1] outline-none">
                <option>7 Days</option>
              </select>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={platformActivityData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey="alarms" name="Alarms Created" stroke="#6366f1" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="challenges" name="Challenges Solved" stroke="#10b981" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Recent Users Table */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 xl:col-span-2 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Users className="w-4 h-4 text-[#8b5cf6]"/> Recent Users</h3>
              <button className="text-xs text-[#6366f1] hover:underline">View All</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#334155] text-xs text-slate-500 dark:text-[#94a3b8]">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Role</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Joined</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {(users || []).slice(0, 5).map((u, i) => (
                    <tr key={i} className="border-b border-slate-200 dark:border-[#334155]/50 hover:bg-slate-50 dark:hover:bg-[#334155]/20">
                      <td className="py-3 font-medium text-slate-900 dark:text-white">{u.name || 'N/A'}</td>
                      <td className="py-3 text-slate-600 dark:text-[#cbd5e1]">{u.email}</td>
                      <td className="py-3">
                        <span className="text-[10px] px-2 py-1 rounded-full bg-slate-200 dark:bg-[#334155] text-slate-600 dark:text-[#cbd5e1] capitalize">
                          {u.role === 'wellness_coach' ? 'Coach' : u.role}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="text-[10px] px-2 py-1 rounded-full bg-[#10b981]/10 text-[#10b981] font-medium border border-[#10b981]/20">
                          Active
                        </span>
                      </td>
                      <td className="py-3 text-right text-slate-500 dark:text-[#94a3b8]">{u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : 'N/A'}</td>
                    </tr>
                  ))}
                  {(!users || users.length === 0) && (
                     <tr><td colSpan="5" className="text-center py-4 text-[#64748b] text-sm">No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Wake-up Verification & Quick Actions */}
          <div className="flex flex-col gap-6 xl:col-span-1">
            
            {/* Wake-up Verification */}
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-[#10b981]"/> Wake-up Verification</h3>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 relative flex-shrink-0">
                   <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Verified', value: 92, color: '#10b981' },
                            { name: 'Pending', value: 6, color: '#f59e0b' },
                            { name: 'Failed', value: 2, color: '#ef4444' }
                          ]} 
                          innerRadius={30} outerRadius={40} dataKey="value" stroke="none"
                        >
                          {[
                            { name: 'Verified', value: 92, color: '#10b981' },
                            { name: 'Pending', value: 6, color: '#f59e0b' },
                            { name: 'Failed', value: 2, color: '#ef4444' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                   </ResponsiveContainer>
                   <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-900 dark:text-white">92%</div>
                </div>
                <div className="flex-1 flex flex-col gap-2">
                   <div className="flex justify-between items-center text-xs"><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#10b981]"></div><span className="text-slate-600 dark:text-[#cbd5e1]">Verified</span></div><span className="font-semibold text-slate-900 dark:text-white">3,142</span></div>
                   <div className="flex justify-between items-center text-xs"><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#f59e0b]"></div><span className="text-slate-600 dark:text-[#cbd5e1]">Pending</span></div><span className="font-semibold text-slate-900 dark:text-white">214</span></div>
                   <div className="flex justify-between items-center text-xs"><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ef4444]"></div><span className="text-slate-600 dark:text-[#cbd5e1]">Failed</span></div><span className="font-semibold text-slate-900 dark:text-white">70</span></div>
                </div>
              </div>
              <div className="mt-4 p-2 bg-[#6366f1]/10 border border-[#6366f1]/20 rounded text-xs text-slate-600 dark:text-[#cbd5e1] flex items-start gap-2">
                <span className="text-xl leading-none">💡</span>
                <p>92% of users are waking up on time! Great job! 🎉</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-[#f59e0b]"/> Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => navigate('/admin/users')} className="flex items-center gap-2 bg-slate-100 dark:bg-[#334155]/50 hover:bg-slate-200 dark:hover:bg-[#334155] text-slate-600 dark:text-[#cbd5e1] hover:text-slate-900 dark:hover:text-white p-3 rounded-lg text-xs transition-colors border border-slate-200 dark:border-[#334155]"><Users className="w-4 h-4 text-[#6366f1]"/> Manage Users</button>
                 <button onClick={() => navigate('/admin/users')} className="flex items-center gap-2 bg-slate-100 dark:bg-[#334155]/50 hover:bg-slate-200 dark:hover:bg-[#334155] text-slate-600 dark:text-[#cbd5e1] hover:text-slate-900 dark:hover:text-white p-3 rounded-lg text-xs transition-colors border border-slate-200 dark:border-[#334155]"><Shield className="w-4 h-4 text-[#10b981]"/> Manage Coaches</button>
                 <button onClick={() => navigate('/admin/announcements')} className="flex items-center gap-2 bg-slate-100 dark:bg-[#334155]/50 hover:bg-slate-200 dark:hover:bg-[#334155] text-slate-600 dark:text-[#cbd5e1] hover:text-slate-900 dark:hover:text-white p-3 rounded-lg text-xs transition-colors border border-slate-200 dark:border-[#334155]"><Megaphone className="w-4 h-4 text-[#f59e0b]"/> Announcements</button>
                 <button onClick={() => navigate('/admin/analytics')} className="flex items-center gap-2 bg-slate-100 dark:bg-[#334155]/50 hover:bg-slate-200 dark:hover:bg-[#334155] text-slate-600 dark:text-[#cbd5e1] hover:text-slate-900 dark:hover:text-white p-3 rounded-lg text-xs transition-colors border border-slate-200 dark:border-[#334155]"><Activity className="w-4 h-4 text-[#8b5cf6]"/> Platform Settings</button>
                 <button onClick={() => navigate('/admin/reports')} className="col-span-2 flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 p-2.5 rounded-lg text-xs font-semibold transition-colors border border-indigo-200 dark:border-indigo-800"><FileText className="w-4 h-4 text-indigo-500"/> Reports & Data Export (PDF & Excel)</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
