import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { CheckCircle, XCircle, Clock, Target } from "lucide-react";
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

import API_URL from "../../config/api";

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] p-3 rounded-lg shadow-xl z-50">
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

export default function CoachVerification() {
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

  // Aggregate Data
  let totalVerified = 0;
  let totalFailed = 0;
  clients.forEach(c => {
    totalVerified += (c.verification_stats?.verified || 0);
    totalFailed += (c.verification_stats?.failed || 0);
  });
  
  const totalVerifications = totalVerified + totalFailed;
  const pieData = [
    { name: 'Verified Wake-ups', value: totalVerified, color: '#10b981' },
    { name: 'Failed/Snoozed', value: totalFailed, color: '#ef4444' }
  ].filter(d => d.value > 0);

  // All recent verifications merged
  const allVerifications = clients.flatMap(c => 
    (c.recent_verifications || []).map(v => ({
      ...v,
      userName: c.name,
      statusStr: v.verification_status === 'verified' ? 'Verified' : 'Failed'
    }))
  ).sort((a, b) => new Date(b.started_at) - new Date(a.started_at));

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 pb-10">
        
        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <CheckCircle className="w-8 h-8 text-[#10b981]" /> Wake-up Verification
            </h1>
            <p className="text-slate-500 dark:text-[#94a3b8]">Review client wake-up compliance and camera verifications.</p>
          </div>
        </div>

        {/* Charts & Summary Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 lg:col-span-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-[#8b5cf6]"/> Overall Verification Status</h3>
            {totalVerifications === 0 ? (
               <div className="h-48 flex items-center justify-center text-slate-500">No verifications yet.</div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-10">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">{Math.round((totalVerified / totalVerifications) * 100)}%</span>
                  <span className="text-xs text-slate-500 dark:text-[#94a3b8]">Success Rate</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 lg:col-span-2 flex flex-col">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-[#f59e0b]"/> Recent Verification Events</h3>
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-3">
                {allVerifications.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No verification events found.</p>
                ) : allVerifications.map((v, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-[#334155]/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${v.statusStr === 'Verified' ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#ef4444]/10 text-[#ef4444]'}`}>
                        {v.statusStr === 'Verified' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{v.userName}</p>
                        <p className="text-xs text-slate-500 dark:text-[#94a3b8]">{new Date(v.started_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <span className={`text-xs font-bold px-2 py-1 rounded-full border ${v.statusStr === 'Verified' ? 'text-[#10b981] border-[#10b981]/20 bg-[#10b981]/10' : 'text-[#ef4444] border-[#ef4444]/20 bg-[#ef4444]/10'}`}>
                         {v.statusStr}
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Detailed List */}
        <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5">
           <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Client Verification Stats</h3>
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="border-b border-slate-200 dark:border-[#334155] text-sm text-slate-500 dark:text-[#94a3b8]">
                   <th className="pb-3 font-medium">Client Name</th>
                   <th className="pb-3 font-medium text-center">Total Verifications</th>
                   <th className="pb-3 font-medium text-center">Verified</th>
                   <th className="pb-3 font-medium text-center">Failed</th>
                 </tr>
               </thead>
               <tbody className="text-sm">
                 {clients.map(c => (
                    <tr key={c.id} className="border-b border-slate-200 dark:border-[#334155]/50 hover:bg-slate-50 dark:hover:bg-[#334155]/20">
                       <td className="py-4 font-medium text-slate-900 dark:text-white">{c.name}</td>
                       <td className="py-4 text-center text-slate-600 dark:text-[#cbd5e1]">{c.verification_stats?.total || 0}</td>
                       <td className="py-4 text-center text-[#10b981] font-semibold">{c.verification_stats?.verified || 0}</td>
                       <td className="py-4 text-center text-[#ef4444] font-semibold">{c.verification_stats?.failed || 0}</td>
                    </tr>
                 ))}
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
