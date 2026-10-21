import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { BrainCircuit, Target, Lightbulb, Users, TrendingUp } from "lucide-react";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

import API_URL from "../../config/api";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] p-3 rounded-lg shadow-xl z-50">
        <p className="text-slate-600 dark:text-[#cbd5e1] mb-1 font-semibold">{label}</p>
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

export default function CoachAnalytics() {
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

  // --- Aggregate Analytics ---
  const activeClients = clients.filter(c => c.active_alarms > 0);
  
  // Calculate Average Speed (solve time) vs Accuracy
  const speedVsAccuracy = clients.map(c => {
    const attempts = c.recent_activity || [];
    const avgTime = attempts.length > 0 
      ? Math.round(attempts.reduce((sum, a) => sum + (a.time_taken_seconds || 0), 0) / attempts.length) 
      : 0;
    
    return {
      name: c.name.split(" ")[0],
      accuracy: c.cognitive_accuracy || 0,
      avgSolveTime: avgTime,
      totalAttempts: attempts.length
    };
  });

  // Calculate difficulty distribution from attempts
  let easy = 0, medium = 0, hard = 0;
  // Fallback mock data if no recent activity exists
  if (clients.every(c => !c.recent_activity || c.recent_activity.length === 0)) {
     easy = 35; medium = 50; hard = 15;
  } else {
     // Mocking difficulty distribution since the API doesn't return challenge difficulty in recent_activity
     // We will use standard distribution based on active users for demo
     easy = clients.length * 12;
     medium = clients.length * 18;
     hard = clients.length * 5;
  }
  
  const difficultyData = [
    { name: 'Easy', value: easy, color: '#10b981' },
    { name: 'Medium', value: medium, color: '#f59e0b' },
    { name: 'Hard', value: hard, color: '#ef4444' }
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 pb-10">
        
        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <BrainCircuit className="w-8 h-8 text-[#06b6d4]" /> Cognitive Analytics
            </h1>
            <p className="text-slate-500 dark:text-[#94a3b8]">Deep dive into user performance and cognitive patterns.</p>
          </div>
        </div>

        {/* Analytics Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] rounded-xl p-5 text-slate-900 dark:text-white shadow-lg relative overflow-hidden">
               <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
               <div className="flex justify-between items-center relative z-10">
                  <div>
                      <p className="text-slate-900 dark:text-white/80 text-sm font-medium">Avg. Cognitive Accuracy</p>
                      <h3 className="text-3xl font-bold mt-1">
                          {clients.length > 0 ? Math.round(clients.reduce((acc, c) => acc + (c.cognitive_accuracy || 0), 0) / clients.length) : 0}%
                      </h3>
                  </div>
                  <Target className="w-10 h-10 text-slate-900 dark:text-white/80" />
               </div>
           </div>
           
           <div className="bg-gradient-to-br from-[#10b981] to-[#059669] rounded-xl p-5 text-slate-900 dark:text-white shadow-lg relative overflow-hidden">
               <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
               <div className="flex justify-between items-center relative z-10">
                  <div>
                      <p className="text-slate-900 dark:text-white/80 text-sm font-medium">Active Engagement</p>
                      <h3 className="text-3xl font-bold mt-1">{activeClients.length} <span className="text-lg font-normal">Clients</span></h3>
                  </div>
                  <Users className="w-10 h-10 text-slate-900 dark:text-white/80" />
               </div>
           </div>

           <div className="bg-gradient-to-br from-[#f59e0b] to-[#d97706] rounded-xl p-5 text-slate-900 dark:text-white shadow-lg relative overflow-hidden">
               <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
               <div className="flex justify-between items-center relative z-10">
                  <div>
                      <p className="text-slate-900 dark:text-white/80 text-sm font-medium">Cognitive Insights</p>
                      <h3 className="text-xl font-bold mt-1 leading-tight">Focus on morning routine</h3>
                  </div>
                  <Lightbulb className="w-10 h-10 text-slate-900 dark:text-white/80" />
               </div>
           </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Speed vs Accuracy Chart */}
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5">
               <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[#6366f1]"/> Speed vs Accuracy (Clients)</h3>
               <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={speedVsAccuracy} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Line yAxisId="left" type="monotone" dataKey="accuracy" name="Accuracy (%)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line yAxisId="right" type="monotone" dataKey="avgSolveTime" name="Avg Time (s)" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Difficulty Distribution Chart */}
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5">
               <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-[#f59e0b]"/> Challenge Difficulty Selection</h3>
               <div className="h-64 flex flex-col justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={difficultyData} innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                        {difficultyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
               </div>
            </div>
        </div>

        {/* Detailed Insights Table */}
        <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5">
           <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Client Cognitive Profile</h3>
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="border-b border-slate-200 dark:border-[#334155] text-sm text-slate-500 dark:text-[#94a3b8]">
                   <th className="pb-3 font-medium">Client</th>
                   <th className="pb-3 font-medium text-center">Avg Time</th>
                   <th className="pb-3 font-medium text-center">Accuracy</th>
                   <th className="pb-3 font-medium text-center">Primary Challenge</th>
                   <th className="pb-3 font-medium text-right">Insight</th>
                 </tr>
               </thead>
               <tbody className="text-sm">
                 {speedVsAccuracy.map((c, i) => (
                    <tr key={i} className="border-b border-slate-200 dark:border-[#334155]/50 hover:bg-slate-50 dark:hover:bg-[#334155]/20">
                       <td className="py-4 font-medium text-slate-900 dark:text-white">{c.name}</td>
                       <td className="py-4 text-center text-slate-600 dark:text-[#cbd5e1]">{c.avgSolveTime}s</td>
                       <td className="py-4 text-center font-semibold text-[#10b981]">{c.accuracy}%</td>
                       <td className="py-4 text-center text-slate-600 dark:text-[#cbd5e1]">Math / Logic</td>
                       <td className="py-4 text-right">
                          <span className={`text-xs px-2 py-1 rounded-full border ${c.accuracy > 80 ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' : 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20'}`}>
                             {c.accuracy > 80 ? 'Optimal' : 'Needs Focus'}
                          </span>
                       </td>
                    </tr>
                 ))}
                 {clients.length === 0 && (
                    <tr>
                       <td colSpan="5" className="text-center py-6 text-slate-500">No data available.</td>
                    </tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
