import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  BrainCircuit, Target, Clock, Flame, 
  Award, Lightbulb, Activity, PieChart as PieChartIcon, CheckCircle2
} from 'lucide-react';

import API_URL from "../../config/api";

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function CognitiveAnalytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/challenges/analytics/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <div className="w-16 h-16 border-4 border-[#6366f1]/20 border-t-[#6366f1] rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 dark:text-[#94a3b8] font-medium animate-pulse">Loading neural analytics...</p>
        </div>
      </DashboardLayout>
    );
  }

  // Formatting Data for Charts
  const chartData = stats?.type_stats ? Object.entries(stats.type_stats).map(([name, data]) => ({
    subject: name,
    successRate: Math.round(data.success_rate),
    completed: data.completed,
    fullMark: 100,
  })) : [];

  const pieData = chartData.filter(d => d.completed > 0).map(d => ({
    name: d.subject,
    value: d.completed
  }));

  // Generating automated insights
  let insights = [];
  if (chartData.length > 0) {
    const sortedBySuccess = [...chartData].sort((a, b) => b.successRate - a.successRate);
    const strongest = sortedBySuccess[0];
    const weakest = sortedBySuccess[sortedBySuccess.length - 1];

    if (strongest && strongest.completed > 0) {
      insights.push({
        type: 'strength',
        text: `Your cognitive strength lies in ${strongest.subject} with an impressive ${strongest.successRate}% success rate.`,
        icon: <Award className="w-5 h-5 text-[#10b981]" />
      });
    }

    if (weakest && weakest.completed > 0 && weakest.successRate < 70) {
      insights.push({
        type: 'improvement',
        text: `Focus more on ${weakest.subject}. Your success rate is currently ${weakest.successRate}%. Practice mode can help!`,
        icon: <Target className="w-5 h-5 text-[#ec4899]" />
      });
    }

    if (stats?.average_solve_time < 15) {
      insights.push({
        type: 'speed',
        text: `You have lightning-fast reflexes! Your average solve time is under 15 seconds.`,
        icon: <Flame className="w-5 h-5 text-[#f59e0b]" />
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      type: 'neutral',
      text: "Complete more challenges to unlock personalized cognitive insights and trends.",
      icon: <Lightbulb className="w-5 h-5 text-[#8b5cf6]" />
    });
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 pb-10">
        
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Activity className="w-8 h-8 text-[#10b981]" /> Cognitive Performance
            </h1>
            <p className="text-slate-500 dark:text-[#94a3b8]">Deep dive into your neural statistics and challenge history.</p>
          </div>
        </div>

        {/* Top Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex flex-col justify-center relative overflow-hidden hover:border-[#6366f1]/50 transition-colors">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#6366f1]/10 rounded-full"></div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#6366f1]/10 flex items-center justify-center"><BrainCircuit className="w-4 h-4 text-[#6366f1]"/></div>
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase tracking-wider">Challenges</span>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats?.total_challenges || 0}</div>
          </div>

          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex flex-col justify-center relative overflow-hidden hover:border-[#10b981]/50 transition-colors">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#10b981]/10 rounded-full"></div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#10b981]/10 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-[#10b981]"/></div>
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase tracking-wider">Success Rate</span>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{(stats?.success_rate || 0).toFixed(1)}%</div>
          </div>

          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex flex-col justify-center relative overflow-hidden hover:border-[#f59e0b]/50 transition-colors">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#f59e0b]/10 rounded-full"></div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center"><Award className="w-4 h-4 text-[#f59e0b]"/></div>
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase tracking-wider">Avg Score</span>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{(stats?.average_score || 0).toFixed(0)}</div>
          </div>

          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex flex-col justify-center relative overflow-hidden hover:border-[#ec4899]/50 transition-colors">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#ec4899]/10 rounded-full"></div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#ec4899]/10 flex items-center justify-center"><Clock className="w-4 h-4 text-[#ec4899]"/></div>
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase tracking-wider">Solve Time</span>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{(stats?.average_solve_time || 0).toFixed(1)}s</div>
          </div>

          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex flex-col justify-center relative overflow-hidden hover:border-[#8b5cf6]/50 transition-colors">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#8b5cf6]/10 rounded-full"></div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#8b5cf6]/10 flex items-center justify-center"><Flame className="w-4 h-4 text-[#8b5cf6]"/></div>
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase tracking-wider">Day Streak</span>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats?.streak || 0}</div>
          </div>
        </div>

        {chartData.length === 0 ? (
           <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-12 text-center">
             <div className="w-20 h-20 bg-slate-50 dark:bg-[#0f172a] rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-[#334155]">
               <Activity className="w-10 h-10 text-[#64748b]" />
             </div>
             <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Data Available</h3>
             <p className="text-slate-500 dark:text-[#94a3b8] max-w-md mx-auto">Complete a few wake-up challenges or practice sessions to generate your cognitive profile and analytics.</p>
           </div>
        ) : (
          <>
            {/* Charts Grid 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Radar Chart */}
              <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-6 shadow-lg shadow-black/10">
                <div className="flex items-center gap-2 mb-6">
                  <Target className="w-5 h-5 text-[#6366f1]" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Performance Radar</h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
                      <PolarGrid stroke="var(--border-light)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Success Rate" dataKey="successRate" stroke="#6366f1" strokeWidth={2} fill="#6366f1" fillOpacity={0.4} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }} itemStyle={{ color: '#818cf8' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-6 shadow-lg shadow-black/10">
                <div className="flex items-center gap-2 mb-6">
                  <Activity className="w-5 h-5 text-[#10b981]" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Success Rate by Type</h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={{stroke: 'var(--border)'}} tickLine={false} />
                      <YAxis dataKey="subject" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={120} axisLine={{stroke: 'var(--border)'}} tickLine={false} />
                      <Tooltip cursor={{ fill: 'var(--border)', opacity: 0.4 }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }} itemStyle={{ color: '#34d399' }} />
                      <Bar dataKey="successRate" name="Success Rate (%)" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20}>
                        {chartData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Charts Grid 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Donut Chart: Activity Distribution */}
              <div className="lg:col-span-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-6 shadow-lg shadow-black/10">
                <div className="flex items-center gap-2 mb-2">
                  <PieChartIcon className="w-5 h-5 text-[#f59e0b]" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Activity Distribution</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-[#94a3b8] mb-6">Which challenges you do most often</p>
                <div className="h-[220px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%" cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-2xl font-bold text-slate-900 dark:text-white">{stats?.completed}</span>
                     <span className="text-[10px] text-[#64748b] uppercase font-bold tracking-wider">Total</span>
                  </div>
                </div>
              </div>

              {/* Cognitive Insights */}
              <div className="lg:col-span-2 bg-gradient-to-br from-white dark:from-[#1e293b] to-slate-50 dark:to-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-xl p-6 shadow-lg shadow-black/10">
                <div className="flex items-center gap-2 mb-6">
                  <Lightbulb className="w-5 h-5 text-[#8b5cf6]" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cognitive Insights</h3>
                </div>
                <div className="flex flex-col gap-4">
                  {insights.map((insight, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-[#0f172a]/80 border border-slate-200 dark:border-[#334155] p-4 rounded-xl flex items-start gap-4">
                      <div className="mt-0.5 bg-white dark:bg-[#1e293b] p-2 rounded-lg border border-slate-200 dark:border-[#334155]">
                        {insight.icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 capitalize">{insight.type}</h4>
                        <p className="text-sm text-slate-500 dark:text-[#cbd5e1] leading-relaxed">{insight.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
