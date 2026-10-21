import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { 
  Users, UserCheck, BrainCircuit, Target,
  TrendingUp, Activity, CheckCircle, ChevronRight, Award, BarChart2, FileText
} from "lucide-react";
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import CombinedReportViewer from "../../components/CombinedReportViewer";

import API_URL from "../../config/api";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] p-3 rounded-lg shadow-xl z-50">
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

export default function CoachDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API_URL}/coach/clients`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6366f1]"></div>
        </div>
      </DashboardLayout>
    );
  }

  // --- Aggregate Data ---
  const totalUsers = clients.length;
  const activeUsers = clients.filter(c => c.active_alarms > 0).length;
  const challengesSolved = clients.reduce((acc, c) => acc + (c.challenge_progress?.completed || 0), 0);
  
  const avgSuccessRate = clients.length > 0 
    ? Math.round(clients.reduce((acc, c) => acc + (c.cognitive_accuracy || 0), 0) / clients.length) 
    : 0;

  // Performance Data for BarChart
  const performanceData = clients.map(c => {
    const total = c.recent_activity?.length || 0;
    const correct = c.recent_activity?.filter(a => a.is_correct).length || 0;
    const incorrect = total - correct;
    return { name: c.name.split(" ")[0], correct, incorrect };
  });

  // Recent Activity merged and sorted
  const allRecentActivity = clients.flatMap(c => 
    (c.recent_activity || []).map(act => ({
      ...act,
      userName: c.name,
      challengeName: act.challenge_id ? `Challenge #${act.challenge_id}` : 'Wake-up Challenge',
      res: act.is_correct ? 'Correct' : 'Incorrect',
      timeStr: `${act.time_taken_seconds}s`
    }))
  ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  // Wake-up Verification stats
  let totalVerified = 0;
  let totalFailed = 0;
  clients.forEach(c => {
    totalVerified += (c.verification_stats?.verified || 0);
    totalFailed += (c.verification_stats?.failed || 0);
  });
  const wakeUpTotal = totalVerified + totalFailed;
  const wakeUpSuccessRate = wakeUpTotal > 0 ? Math.round((totalVerified / wakeUpTotal) * 100) : 0;

  // Mock data for graphs not strictly bound to simple aggregates
  const challengeDistData = [
    { name: 'Math Problems', value: 35, color: '#6366f1' }, { name: 'Logic Puzzles', value: 22, color: '#ec4899' },
    { name: 'Memory Challenges', value: 18, color: '#10b981' }, { name: 'Word Games', value: 15, color: '#f59e0b' }
  ];

  const engagementData = [
    { name: 'Mon', completion: 60, active: 40 }, { name: 'Tue', completion: 70, active: 55 },
    { name: 'Wed', completion: 80, active: 75 }, { name: 'Thu', completion: 65, active: 60 },
    { name: 'Fri', completion: 85, active: 80 }, { name: 'Sat', completion: 90, active: 90 },
    { name: 'Sun', completion: 95, active: 95 }
  ];

  // Top users by cognitive accuracy
  const topUsers = [...clients].sort((a, b) => (b.cognitive_accuracy || 0) - (a.cognitive_accuracy || 0)).slice(0, 5).map((c, i) => ({
    name: c.name,
    rank: i + 1,
    score: `${c.cognitive_accuracy || 0}%`,
    avatar: c.name.charAt(0).toUpperCase()
  }));

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 pb-10">
        
        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              Welcome, {user.name}! <span className="text-2xl">👋</span>
            </h1>
            <p className="text-slate-500 dark:text-[#94a3b8]">Guide users towards better mornings.</p>
          </div>
          <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-xl p-4 hidden md:flex items-center gap-4 max-w-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#10b981]/10 blur-2xl rounded-full"></div>
            <Target className="text-[#10b981] w-8 h-8" />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white italic">"Better mornings build brighter futures."</p>
            </div>
          </div>
        </div>

        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: totalUsers, sub: 'Under Your Guidance', change: '+ 8%', icon: Users, color: 'text-[#6366f1]', bg: 'bg-[#6366f1]/10', trend: 'text-[#10b981]' },
            { label: 'Active Users', value: activeUsers, sub: 'Used alarm this week', change: '+ 12%', icon: UserCheck, color: 'text-[#10b981]', bg: 'bg-[#10b981]/10', trend: 'text-[#10b981]' },
            { label: 'Challenges Solved', value: challengesSolved, sub: 'This week', change: '+ 20%', icon: BrainCircuit, color: 'text-[#8b5cf6]', bg: 'bg-[#8b5cf6]/10', trend: 'text-[#10b981]' },
            { label: 'Avg. Success Rate', value: `${avgSuccessRate}%`, sub: 'Across Your Users', change: '+ 6%', icon: Target, color: 'text-[#10b981]', bg: 'bg-[#10b981]/10', trend: 'text-[#10b981]' },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#283548] transition-colors relative overflow-hidden">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
                  <div className="text-sm text-slate-500 dark:text-[#94a3b8]">{stat.label}</div>
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
          {/* User Challenge Performance */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Target className="w-4 h-4 text-[#ec4899]"/> User Challenge Performance</h3>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="correct" name="Correct" fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="incorrect" name="Incorrect" fill="#ef4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Challenge Type Distribution */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 lg:col-span-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><BrainCircuit className="w-4 h-4 text-[#06b6d4]"/> Challenge Type Distribution</h3>
            <div className="flex items-center justify-center h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={challengeDistData} innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value"
                  >
                    {challengeDistData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">Total</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 lg:col-span-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-[#f59e0b]"/> Quick Actions</h3>
            <div className="flex flex-col gap-3">
              {[
                { icon: Users, label: 'View All Users', color: 'text-[#6366f1]', link: '/coach/users' },
                { icon: BarChart2, label: 'View Challenge Analytics', color: 'text-[#06b6d4]', link: '/coach/analytics' },
                { icon: CheckCircle, label: 'Verify Wake-up Submissions', color: 'text-[#10b981]', link: '/coach/verification' },
                { icon: FileText, label: 'Reports & Data Export', color: 'text-[#ec4899]', link: '/coach/reports' }
              ].map((action, i) => (
                <a key={i} href={action.link} className="flex items-center justify-between p-3 rounded-lg bg-slate-200 dark:bg-[#334155]/30 hover:bg-slate-200 dark:bg-[#334155]/60 transition-colors border border-slate-200 dark:border-[#334155]/50 group">
                  <div className="flex items-center gap-3">
                    <action.icon className={`w-5 h-5 ${action.color}`} />
                    <span className="text-sm text-slate-600 dark:text-[#cbd5e1] group-hover:text-slate-900 dark:text-white">{action.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#64748b] group-hover:text-slate-900 dark:text-white" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent User Activity */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 lg:col-span-1 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Activity className="w-4 h-4 text-[#8b5cf6]"/> Recent User Activity</h3>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="flex flex-col gap-3">
                {allRecentActivity.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent activity found.</p>
                ) : allRecentActivity.map((act, i) => (
                  <div key={i} className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#334155]/50 last:border-0 last:pb-0">
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">{act.userName}</p>
                      <p className="text-[10px] text-slate-500 dark:text-[#94a3b8]">{act.challengeName}</p>
                    </div>
                    <div className="text-right">
                       <span className={`text-[10px] font-semibold ${act.res === 'Correct' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>{act.res}</span>
                       <p className="text-[10px] text-[#64748b]">{act.timeStr}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Wake-up Verification Status */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 lg:col-span-1">
             <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Target className="w-4 h-4 text-[#10b981]"/> Wake-up Verification</h3>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="w-24 h-24 relative flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Verified', value: wakeUpSuccessRate || 100, color: '#10b981' },
                          { name: 'Failed', value: wakeUpSuccessRate ? 100 - wakeUpSuccessRate : 0, color: '#ef4444' }
                        ]} 
                        innerRadius={30} outerRadius={40} dataKey="value" stroke="none"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#ef4444" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-900 dark:text-white">{wakeUpSuccessRate}%</div>
              </div>
              <div className="flex-1 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs"><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#10b981]"></div><span className="text-slate-600 dark:text-[#cbd5e1]">Verified</span></div><span className="font-semibold text-slate-900 dark:text-white">{totalVerified}</span></div>
                  <div className="flex justify-between items-center text-xs"><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ef4444]"></div><span className="text-slate-600 dark:text-[#cbd5e1]">Failed/Snoozed</span></div><span className="font-semibold text-slate-900 dark:text-white">{totalFailed}</span></div>
              </div>
            </div>
            <div className="mt-6 p-2 bg-[#6366f1]/10 border border-[#6366f1]/20 rounded text-xs text-slate-600 dark:text-[#cbd5e1] flex items-start gap-2">
              <span className="text-xl leading-none">🌟</span>
              <p>Keep your clients accountable to achieve 100% verification!</p>
            </div>
          </div>

          {/* User Engagement Trend */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 lg:col-span-1">
             <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-[#8b5cf6]"/> User Engagement Trend</h3>
             <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={engagementData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey="completion" name="Challenge Completion Rate" stroke="#ec4899" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="active" name="Active Users" stroke="#06b6d4" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Users Overview & Top Performers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 lg:col-span-2 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Users className="w-4 h-4 text-[#8b5cf6]"/> Users Overview</h3>
                <div className="flex items-center gap-3">
                  <a href="/coach/messages" className="text-xs bg-[#6366f1]/10 text-[#6366f1] hover:bg-[#6366f1]/20 px-2.5 py-1 rounded-lg font-medium transition-colors">Messages & Recommendations</a>
                  <a href="/coach/users" className="text-xs text-[#6366f1] hover:underline">View All</a>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#334155] text-xs text-slate-500 dark:text-[#94a3b8]">
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Active Alarms</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Habit Progress</th>
                      <th className="pb-2 font-medium text-right">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {clients.map((u, i) => (
                      <tr key={i} className="border-b border-slate-200 dark:border-[#334155]/50 hover:bg-slate-200 dark:bg-[#334155]/20">
                        <td className="py-3 font-medium text-slate-900 dark:text-white">{u.name}</td>
                        <td className="py-3 text-slate-600 dark:text-[#cbd5e1]">{u.active_alarms}</td>
                        <td className="py-3">
                          <span className={`text-[10px] px-2 py-1 rounded-full font-medium border ${u.active_alarms > 0 ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' : 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20'}`}>
                            {u.active_alarms > 0 ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 text-slate-600 dark:text-[#cbd5e1]">{u.habit_progress?.completed}/{u.habit_progress?.total}</td>
                        <td className="py-3 text-right font-semibold text-slate-900 dark:text-white">{u.cognitive_accuracy}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </div>

           <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 lg:col-span-1">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Award className="w-4 h-4 text-[#f59e0b]"/> Top Performing Users</h3>
              </div>
              <div className="flex flex-col gap-4 mt-2">
                 {topUsers.length === 0 ? (
                    <p className="text-sm text-slate-500">No users found.</p>
                 ) : topUsers.map((user, i) => (
                    <div key={i} className="flex items-center gap-3">
                       <div className="font-bold text-[#64748b] w-4 text-center">{user.rank}</div>
                       <div className="w-8 h-8 rounded-full bg-[#6366f1] flex items-center justify-center text-xs font-bold text-slate-900 dark:text-white shadow-lg">
                          {user.avatar}
                       </div>
                       <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{user.name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-[#94a3b8]">Top Performer</p>
                       </div>
                       <div className="text-sm font-bold text-[#10b981]">{user.score}</div>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Client Unified Performance Reports (PDF & Excel) */}
        <CombinedReportViewer 
          users={clients} 
          role="coach" 
          title="Client Combined Performance Reports" 
          subtitle="Select an authorized client to preview all five report sections and download their combined report as one PDF or Excel workbook."
        />
      </div>
    </DashboardLayout>
  );
}
