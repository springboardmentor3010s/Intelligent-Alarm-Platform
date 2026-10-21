import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { Target, BrainCircuit, Activity } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

import API_URL from "../../config/api";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] p-3 rounded-lg shadow-xl z-50">
        <p className="text-slate-600 dark:text-[#cbd5e1] mb-1 font-semibold">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function CoachPerformance() {
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

  // Performance Data for BarChart
  const performanceData = clients.map(c => {
    const total = c.recent_activity?.length || 0;
    const correct = c.recent_activity?.filter(a => a.is_correct).length || 0;
    const incorrect = total - correct;
    return { name: c.name, correct, incorrect, accuracy: c.cognitive_accuracy };
  }).filter(c => c.correct > 0 || c.incorrect > 0 || c.accuracy > 0); // Only show users with some data

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 pb-10">
        
        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <Target className="w-8 h-8 text-[#ec4899]" /> Challenge Performance
            </h1>
            <p className="text-slate-500 dark:text-[#94a3b8]">Monitor cognitive challenge results for your assigned clients.</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Challenge Performance */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">Recent Correct vs Incorrect</h3>
            </div>
            {performanceData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-slate-500">No challenge data available yet.</div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#64748b" tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="correct" name="Correct Responses" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="incorrect" name="Incorrect Responses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* User Accuracy */}
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Activity className="w-5 h-5 text-[#f59e0b]"/> Overall Cognitive Accuracy (%)</h3>
            </div>
            {performanceData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-slate-500">No accuracy data available yet.</div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#64748b" tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="accuracy" name="Accuracy %" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Detailed List */}
        <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5">
           <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-[#06b6d4]"/> Detailed Performance Log</h3>
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="border-b border-slate-200 dark:border-[#334155] text-sm text-slate-500 dark:text-[#94a3b8]">
                   <th className="pb-3 font-medium">Client Name</th>
                   <th className="pb-3 font-medium text-center">Total Challenges Completed</th>
                   <th className="pb-3 font-medium text-center">Cognitive Accuracy</th>
                   <th className="pb-3 font-medium">Recent Activity Highlight</th>
                 </tr>
               </thead>
               <tbody className="text-sm">
                 {clients.map(c => {
                    const recent = c.recent_activity?.[0];
                    return (
                       <tr key={c.id} className="border-b border-slate-200 dark:border-[#334155]/50 hover:bg-slate-50 dark:hover:bg-[#334155]/20">
                          <td className="py-4 font-medium text-slate-900 dark:text-white">{c.name}</td>
                          <td className="py-4 text-center text-slate-600 dark:text-[#cbd5e1]">{c.challenge_progress?.completed || 0}</td>
                          <td className="py-4 text-center text-slate-600 dark:text-[#cbd5e1]">
                             <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${c.cognitive_accuracy >= 80 ? 'bg-[#10b981]/10 text-[#10b981]' : c.cognitive_accuracy >= 50 ? 'bg-[#f59e0b]/10 text-[#f59e0b]' : 'bg-[#ef4444]/10 text-[#ef4444]'}`}>
                               {c.cognitive_accuracy || 0}%
                             </span>
                          </td>
                          <td className="py-4 text-slate-600 dark:text-[#cbd5e1]">
                             {recent ? (
                                <span className="flex items-center gap-2 text-xs">
                                   Challenge #{recent.challenge_id} 
                                   <span className={`font-semibold ${recent.is_correct ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>({recent.is_correct ? 'Correct' : 'Incorrect'})</span>
                                </span>
                             ) : <span className="text-slate-400 italic">No activity yet</span>}
                          </td>
                       </tr>
                    )
                 })}
                 {clients.length === 0 && (
                    <tr>
                       <td colSpan="4" className="text-center py-6 text-slate-500">No clients assigned to you.</td>
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
