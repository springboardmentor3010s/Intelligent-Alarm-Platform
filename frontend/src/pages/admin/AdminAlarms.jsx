import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { 
  Bell, 
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  BrainCircuit,
  Volume2
} from "lucide-react";

import API_URL from "../../config/api";

export default function AdminAlarms() {
  const token = localStorage.getItem("access_token");
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("All");

  useEffect(() => {
    async function fetchAlarms() {
      try {
        const res = await fetch(`${API_URL}/admin/alarms`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAlarms(data);
        }
      } catch (error) {
        console.error("Failed to fetch alarms:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAlarms();
  }, [token]);

  const filteredAlarms = alarms.filter((a) => {
    const matchesSearch = (a.user_name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (a.label || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === "All" || 
                          (filterType === "Active" && a.is_active) ||
                          (filterType === "Inactive" && !a.is_active);
    return matchesSearch && matchesFilter;
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 pb-10">
        
        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <Bell className="w-8 h-8 text-[#f59e0b]" />
              Alarms Management
            </h1>
            <p className="text-slate-500 dark:text-[#94a3b8]">Oversee and monitor all active cognitive alarms across the platform.</p>
          </div>
          
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-3 flex gap-4 items-center shadow-sm">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-[#0f172a] rounded-lg border border-slate-200 dark:border-[#334155]">
                <Volume2 className="w-4 h-4 text-[#10b981]" />
                <span className="text-sm font-semibold text-slate-700 dark:text-[#cbd5e1]">
                   {alarms.filter(a => a.is_active).length} Active
                </span>
             </div>
             <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-[#0f172a] rounded-lg border border-slate-200 dark:border-[#334155]">
                <Clock className="w-4 h-4 text-slate-500 dark:text-[#94a3b8]" />
                <span className="text-sm font-semibold text-slate-700 dark:text-[#cbd5e1]">
                   {alarms.length} Total Alarms
                </span>
             </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-[#f59e0b]/5 blur-2xl rounded-full"></div>
           <div className="relative flex items-center w-full md:w-96">
              <Search className="w-5 h-5 text-slate-400 absolute left-3" />
              <input 
                type="text"
                placeholder="Search by user or alarm label..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/50 transition-all"
              />
           </div>
           
           <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/50 transition-all"
              >
                 <option value="All">All Alarms</option>
                 <option value="Active">Active Only</option>
                 <option value="Inactive">Inactive Only</option>
              </select>
           </div>
        </div>

        {/* Alarms Table */}
        <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl overflow-hidden flex flex-col shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#0f172a] border-b border-slate-200 dark:border-[#334155] text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase tracking-wider">
                  <th className="p-4">User</th>
                  <th className="p-4">Time</th>
                  <th className="p-4">Label & Days</th>
                  <th className="p-4">Challenge</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-200 dark:divide-[#334155]/50">
                {loading ? (
                   <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500 dark:text-[#94a3b8]">
                         <div className="flex flex-col items-center gap-3">
                            <Bell className="w-8 h-8 text-[#f59e0b] animate-bounce" />
                            <span>Loading alarms...</span>
                         </div>
                      </td>
                   </tr>
                ) : filteredAlarms.length === 0 ? (
                   <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500 dark:text-[#94a3b8]">
                         No alarms found matching your criteria.
                      </td>
                   </tr>
                ) : (
                  filteredAlarms.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-[#334155]/20 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#334155] flex items-center justify-center text-slate-600 dark:text-[#f8fafc]">
                            {a.user_name ? a.user_name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <span className="font-medium text-slate-900 dark:text-white">{a.user_name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                           <Clock className="w-4 h-4 text-slate-400" />
                           <span className="text-xl font-bold text-slate-900 dark:text-white">
                              {a.time}
                           </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                           <span className="font-medium text-slate-700 dark:text-[#cbd5e1]">{a.label}</span>
                           <span className="text-[10px] text-slate-500 dark:text-[#94a3b8]">{a.days_of_week}</span>
                        </div>
                      </td>
                      <td className="p-4">
                         <div className="flex flex-col gap-1">
                            <span className="text-sm text-slate-700 dark:text-[#cbd5e1] flex items-center gap-1.5">
                               <BrainCircuit className="w-3.5 h-3.5 text-[#6366f1]"/> {a.challenge_type}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 w-fit rounded-full border font-medium ${
                              a.difficulty === 'Expert' || a.difficulty === 'Hard' ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20' : 
                              a.difficulty === 'Medium' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20' : 
                              'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20'
                            }`}>
                              {a.difficulty}
                            </span>
                         </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                          a.is_active 
                            ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' 
                            : 'bg-slate-100 dark:bg-[#334155] text-slate-500 dark:text-[#94a3b8] border-slate-200 dark:border-[#475569]'
                        }`}>
                          {a.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {a.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
