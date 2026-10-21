import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Users, Target, Activity } from 'lucide-react';

import API_URL from "../../config/api";

export default function PlatformAnalytics() {
  const token = localStorage.getItem("access_token");
  const [stats, setStats] = useState({ total_users: 0, challenge_success_rate: 0, total_challenges: 0 });
  const [userGrowthData, setUserGrowthData] = useState([]);
  const [challengeSuccessData, setChallengeSuccessData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, histRes] = await Promise.all([
          fetch(`${API_URL}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/admin/analytics/historical`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        
        if (statsRes.ok) setStats(await statsRes.json());
        if (histRes.ok) {
          const hist = await histRes.json();
          setUserGrowthData(hist.userGrowth);
          setChallengeSuccessData(hist.challengeSuccess);
        }
      } catch (err) {
        console.error("Failed to load analytics", err);
      } finally {
        setLoading(false);
      }
    }
    if (token) fetchData();
  }, [token]);
  return (
    <DashboardLayout title="Platform Analytics" subtitle="Deep dive into user growth and challenge performance across the platform.">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-[#6366f1]/20 p-2 rounded-lg">
              <Users className="w-5 h-5 text-[#6366f1]" />
            </div>
            <h3 className="text-slate-500 dark:text-[#94a3b8] font-medium text-sm">Total Active Users</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{loading ? "..." : stats.total_users}</p>
          <p className="text-xs text-[#10b981] mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Live Data
          </p>
        </div>
        
        <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-[#10b981]/20 p-2 rounded-lg">
              <Target className="w-5 h-5 text-[#10b981]" />
            </div>
            <h3 className="text-slate-500 dark:text-[#94a3b8] font-medium text-sm">Challenge Success Rate</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{loading ? "..." : `${stats.challenge_success_rate}%`}</p>
          <p className="text-xs text-[#10b981] mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Live Data
          </p>
        </div>

        <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-[#f59e0b]/20 p-2 rounded-lg">
              <Activity className="w-5 h-5 text-[#f59e0b]" />
            </div>
            <h3 className="text-slate-500 dark:text-[#94a3b8] font-medium text-sm">Avg. Challenges/User</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {loading ? "..." : (stats.total_users > 0 ? (stats.total_challenges / stats.total_users).toFixed(1) : 0)}
          </p>
          <p className="text-xs text-[#10b981] mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Live Data
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* User Growth Chart */}
        <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">User Growth (Last 6 Months)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Area type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Challenge Success Rate Chart */}
        <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Challenge Success vs Failures</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={challengeSuccessData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="success" name="Successful" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="fail" name="Failed/Snoozed" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
