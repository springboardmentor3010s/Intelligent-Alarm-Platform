import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { 
  FileText, Download, Activity, Clock, BrainCircuit, 
  TrendingUp, Moon, Calendar, CheckCircle2, AlertCircle, 
  RefreshCw, FileSpreadsheet, Eye, ChevronRight, Award, Zap, ShieldCheck
} from 'lucide-react';

import API_URL from "../../config/api";

export default function Reports() {
  const [days, setDays] = useState(30);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState({ pdf: false, excel: false });
  const [reportData, setReportData] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [error, setError] = useState(null);

  // Fetch report data for preview
  const fetchReportData = async (selectedDays = days, start = customStart, end = customEnd, custom = isCustom) => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("access_token");
    try {
      let url = `${API_URL}/reports/data?days=${selectedDays}`;
      if (custom && start && end) {
        url += `&start_date=${start}&end_date=${end}`;
      }
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error("Failed to load user report data");
      }
      const data = await response.json();
      setReportData(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error generating report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData(30, "", "", false);
  }, []);

  const handleGenerate = (e) => {
    e.preventDefault();
    fetchReportData(days, customStart, customEnd, isCustom);
  };

  // Download complete report as PDF / Excel containing all 5 sections
  const handleDownload = async (format) => {
    setDownloading(prev => ({ ...prev, [format]: true }));
    const token = localStorage.getItem("access_token");
    try {
      let url = `${API_URL}/reports/export/${format}?days=${days}&type=all`;
      if (isCustom && customStart && customEnd) {
        url += `&start_date=${customStart}&end_date=${customEnd}`;
      }
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        const ext = format === 'excel' ? 'xlsx' : 'pdf';
        const userName = reportData?.user_info?.name?.replace(/\s+/g, '_') || 'User';
        a.download = `Complete_User_Report_${userName}_${days}days.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        alert(`Failed to download ${format.toUpperCase()} report.`);
      }
    } catch (err) {
      console.error(err);
      alert(`Error during download: ${err.message}`);
    } finally {
      setDownloading(prev => ({ ...prev, [format]: false }));
    }
  };

  const hr = reportData?.habit_report;
  const wr = reportData?.wakeup_report;
  const cr = reportData?.challenge_report;
  const pr = reportData?.productivity_report;
  const sr = reportData?.sleep_report;
  const userInfo = reportData?.user_info;

  return (
    <DashboardLayout 
      title="User Reports & Data Export" 
      subtitle="Select a date range, preview your unified performance analytics, and download everything in one consolidated PDF or Excel file."
    >
      <div className="space-y-8 mt-6">

        {/* =========================================================================
            TOP WORKFLOW CONTROL CARD: Select Date Range -> Generate -> Download
            ========================================================================= */}
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/60 transition-colors">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            
            {/* Left: Date Range Controls */}
            <form onSubmit={handleGenerate} className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-500" /> Date Range:
              </span>

              {/* Quick Select Buttons */}
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700/60">
                {[
                  { label: "7 Days", val: 7 },
                  { label: "30 Days", val: 30 },
                  { label: "90 Days", val: 90 },
                ].map(opt => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => {
                      setIsCustom(false);
                      setDays(opt.val);
                      fetchReportData(opt.val, "", "", false);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      !isCustom && days === opt.val
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsCustom(true)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    isCustom
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Custom
                </button>
              </div>

              {/* Custom Date Pickers */}
              {isCustom && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required={isCustom}
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required={isCustom}
                  />
                </div>
              )}

              {/* Generate Report Button */}
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? "Generating..." : "Generate Report"}
              </button>
            </form>

            {/* Right: Exactly Two Download Options (PDF and Excel) containing all 5 sections */}
            <div className="flex items-center gap-3 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 dark:border-slate-800 flex-wrap shrink-0">
              <button
                id="export-pdf-top-btn"
                onClick={() => handleDownload('pdf')}
                disabled={loading || downloading.pdf || !reportData}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold rounded-xl whitespace-nowrap shrink-0 shadow-sm hover:shadow-md hover:shadow-rose-500/20 transition-all disabled:opacity-50 cursor-pointer"
                title="Download complete report containing all five sections as PDF"
              >
                <Download className="w-4 h-4" />
                {downloading.pdf ? "Building PDF..." : "Download Complete Report (PDF)"}
              </button>

              <button
                id="export-excel-top-btn"
                onClick={() => handleDownload('excel')}
                disabled={loading || downloading.excel || !reportData}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl whitespace-nowrap shrink-0 shadow-sm hover:shadow-md hover:shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
                title="Download complete report containing all five worksheets as Excel workbook"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {downloading.excel ? "Building Excel..." : "Download Complete Report (Excel)"}
              </button>
            </div>

          </div>

          {/* Report Metadata Status Bar */}
          {userInfo && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <ShieldCheck className="w-4 h-4" /> Data Scoped to: {userInfo.name}
                </span>
                <span>•</span>
                <span>Period: <strong className="text-slate-700 dark:text-slate-200">{userInfo.date_range}</strong></span>
              </div>
              <div className="text-slate-400">
                Generated: {userInfo.generated_at}
              </div>
            </div>
          )}
        </div>

        {/* Error message if any */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* =========================================================================
            SUMMARY CARDS FOR THE 5 CATEGORIES
            ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Card 1: Habit Report */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700/60 relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">1. Habit Report</span>
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {hr ? (hr.has_data ? hr.habit_score : "No data") : "--"}
                </span>
                {hr && hr.has_data && <span className="text-xs font-medium text-slate-400">/ 100</span>}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Consistency: <strong className="text-indigo-600 dark:text-indigo-400">{hr?.has_data ? `${hr.consistency_score}/35 pts` : "No records"}</strong>
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
              35/25/20/20 Weighted Score
            </div>
          </div>

          {/* Card 2: Wake-Up Report */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700/60 relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">2. Wake-Up Report</span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {wr ? (wr.total_wakeups > 0 ? `${wr.success_rate}%` : "No data") : "--"}
                </span>
                {wr && wr.total_wakeups > 0 && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Success</span>}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Delay: <strong className="text-slate-700 dark:text-slate-200">{wr?.total_wakeups > 0 ? `${wr.avg_delay_minutes} min` : "No records"}</strong> • {wr?.total_wakeups > 0 ? `${wr.total_snoozes} snoozes` : "0 snoozes"}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
              {wr?.total_wakeups > 0 ? `${wr.successful_wakeups}/${wr.total_wakeups} wake-ups verified` : "No wake-ups recorded"}
            </div>
          </div>

          {/* Card 3: Challenge Performance */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700/60 relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">3. Challenge Report</span>
              <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <BrainCircuit className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {cr ? (cr.total_attempts > 0 ? `${cr.success_rate}%` : "No data") : "--"}
                </span>
                {cr && cr.total_attempts > 0 && <span className="text-xs font-medium text-sky-600 dark:text-sky-400">Accuracy</span>}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Avg Time: <strong className="text-slate-700 dark:text-slate-200">{cr?.total_attempts > 0 ? `${cr.avg_solve_time}s` : "No records"}</strong>
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
              {cr?.total_attempts > 0 ? `${cr.total_attempts} attempts logged` : "No attempts recorded"}
            </div>
          </div>

          {/* Card 4: Productivity Report */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700/60 relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">4. Productivity</span>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {pr ? (pr.total_goals > 0 ? `${pr.completion_rate}%` : "No data") : "--"}
                </span>
                {pr && pr.total_goals > 0 && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Completed</span>}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Goals: <strong className="text-slate-700 dark:text-slate-200">{pr ? `${pr.completed_goals}/${pr.total_goals}` : "--"}</strong> active
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
              Habits & goal tracking
            </div>
          </div>

          {/* Card 5: Sleep Analytics */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700/60 relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">5. Sleep Analytics</span>
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Moon className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {sr?.has_data ? `${sr.avg_sleep_duration}` : "No data"}
                </span>
                {sr?.has_data && <span className="text-xs font-medium text-purple-600 dark:text-purple-400">hrs avg</span>}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Adherence: <strong className="text-slate-700 dark:text-slate-200">{sr?.has_data ? `${sr.schedule_adherence_pct}%` : "No logs"}</strong>
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
              {sr ? `${sr.target_sleep_start} → ${sr.target_sleep_end}` : "Target schedule"}
            </div>
          </div>

        </div>

        {/* =========================================================================
            PREVIEW COMPLETE REPORT SECTION
            ========================================================================= */}
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden transition-colors">
          
          {/* Section Header with Tabs */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Preview Complete Report</h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Review all 5 sections before downloading your consolidated PDF or Excel workbook.
              </p>
            </div>

            {/* Filter category tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
              {[
                { id: "all", label: "All 5 Sections" },
                { id: "habit", label: "1. Habit" },
                { id: "wakeup", label: "2. Wake-Up" },
                { id: "challenge", label: "3. Challenge" },
                { id: "prod", label: "4. Productivity" },
                { id: "sleep", label: "5. Sleep" },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-[#1e293b] text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 space-y-10">

            {/* -----------------------------------------------------------------
                SECTION 1: HABIT REPORT & 35/25/20/20 BREAKDOWN
                ----------------------------------------------------------------- */}
            {(activeTab === "all" || activeTab === "habit") && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-6 bg-indigo-500 rounded-full" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">1. Habit Report</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Cognitive Habit Score ({hr?.habit_score || 0}/100) & 35/25/20/20 Pillar Distribution
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-500/20">
                    Score: {hr?.habit_score || 0} / 100
                  </span>
                </div>

                {/* 35/25/20/20 Breakdown Grid */}
                {hr?.breakdown && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(hr.breakdown).map(([key, item]) => {
                      const colorsMap = {
                        wake_up_consistency: { bg: 'bg-indigo-500', light: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400' },
                        challenge_completion: { bg: 'bg-sky-500', light: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400' },
                        snooze_reduction: { bg: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
                        sleep_adherence: { bg: 'bg-purple-500', light: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
                      };
                      const col = colorsMap[key] || { bg: 'bg-indigo-500', light: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-600' };

                      return (
                        <div key={key} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            <span>{item.name}</span>
                            <span className={`px-2 py-0.5 rounded-md ${col.light} ${col.text} text-[11px]`}>
                              {item.weight}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between mb-2">
                            <span className="text-xl font-bold text-slate-900 dark:text-white">
                              {item.score} <span className="text-xs font-normal text-slate-400">/ {item.max_points} pts</span>
                            </span>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                              {item.percentage}%
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${col.bg} transition-all duration-500 rounded-full`}
                              style={{ width: `${Math.min(100, item.percentage)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Daily Habit Scores History Table */}
                {hr?.history && hr.history.length > 0 && (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700/60">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Habit Score</th>
                          <th className="px-4 py-3">Wake Consistency (35)</th>
                          <th className="px-4 py-3">Challenge Rate (25)</th>
                          <th className="px-4 py-3">Snoozes (20)</th>
                          <th className="px-4 py-3">Sleep Adherence (20)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {hr.history.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{row.date}</td>
                            <td className="px-4 py-2.5 font-bold text-indigo-600 dark:text-indigo-400">{row.habit_score}</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{row.wake_up_score} / 35</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{row.challenge_rate}%</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{row.snooze_count} snoozes</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{row.sleep_score} / 20</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* -----------------------------------------------------------------
                SECTION 2: WAKE-UP REPORT
                ----------------------------------------------------------------- */}
            {(activeTab === "all" || activeTab === "wakeup") && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-6 bg-emerald-500 rounded-full" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">2. Wake-Up Report</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Successful wake-ups, wake-up delays, and snoozes tracking
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
                    Success Rate: {wr?.success_rate || 0}%
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Successful Wake-ups</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {wr?.successful_wakeups || 0} <span className="text-xs font-normal text-slate-400">/ {wr?.total_wakeups || 0} events</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Average Wake-Up Delay</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {wr?.avg_delay_minutes || 0} <span className="text-xs font-normal text-slate-400">minutes</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Total Snoozes</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {wr?.total_snoozes || 0} <span className="text-xs font-normal text-slate-400">({wr?.avg_snoozes || 0} avg/day)</span>
                    </p>
                  </div>
                </div>

                {/* Wake-Up Events Log Table */}
                {wr?.events && wr.events.length > 0 ? (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700/60">
                        <tr>
                          <th className="px-4 py-3">Date & Time</th>
                          <th className="px-4 py-3">Scheduled</th>
                          <th className="px-4 py-3">Actual Wake</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Wake-Up Delay</th>
                          <th className="px-4 py-3">Snoozes</th>
                          <th className="px-4 py-3">Challenges</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {wr.events.slice(0, 10).map((ev, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{ev.date}</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{ev.scheduled_time || 'N/A'}</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{ev.actual_time || 'N/A'}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                ev.status === "Successful" 
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              }`}>
                                {ev.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{ev.delay_minutes} min</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{ev.snoozes}</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{ev.completed_challenges}/{ev.required_challenges}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 text-center text-xs text-slate-500 dark:text-slate-400 py-4">
                    No wake-up events recorded in this date range.
                  </div>
                )}
              </div>
            )}

            {/* -----------------------------------------------------------------
                SECTION 3: CHALLENGE PERFORMANCE REPORT
                ----------------------------------------------------------------- */}
            {(activeTab === "all" || activeTab === "challenge") && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-6 bg-sky-500 rounded-full" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">3. Challenge Performance Report</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Success rate, attempts, solve time, and challenge types
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-lg border border-sky-200 dark:border-sky-500/20">
                    Accuracy: {cr?.success_rate || 0}%
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Total Attempts</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {cr?.total_attempts || 0} <span className="text-xs font-normal text-slate-400">({cr?.successful_attempts || 0} solved)</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Average Solve Time</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {cr?.avg_solve_time || 0} <span className="text-xs font-normal text-slate-400">seconds</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Average Cognitive Score</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {cr?.avg_score || 0} <span className="text-xs font-normal text-slate-400">/ 100</span>
                    </p>
                  </div>
                </div>

                {/* Challenge Types Breakdown Table */}
                {cr?.types_breakdown && cr.types_breakdown.length > 0 && (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700/60">
                        <tr>
                          <th className="px-4 py-3">Challenge Type</th>
                          <th className="px-4 py-3">Total Attempts</th>
                          <th className="px-4 py-3">Solved Correctly</th>
                          <th className="px-4 py-3">Success Rate</th>
                          <th className="px-4 py-3">Average Solve Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {cr.types_breakdown.map((t, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{t.type}</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{t.total_attempts}</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{t.successful}</td>
                            <td className="px-4 py-2.5 font-semibold text-sky-600 dark:text-sky-400">{t.success_rate}%</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{t.avg_solve_time}s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* -----------------------------------------------------------------
                SECTION 4: PRODUCTIVITY REPORT
                ----------------------------------------------------------------- */}
            {(activeTab === "all" || activeTab === "prod") && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-6 bg-amber-500 rounded-full" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">4. Productivity Report</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Productivity goals and progress tracking
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-500/20">
                    Completion: {pr?.completion_rate || 0}%
                  </span>
                </div>

                {/* Stated Productivity Goals Box */}
                {pr?.productivity_goals_text && (
                  <div className="p-4 rounded-xl border border-amber-200/60 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5">
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Target Productivity Goals:</span>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">
                      {pr.productivity_goals_text}
                    </p>
                  </div>
                )}

                {/* Habits List Table */}
                {pr?.habits && pr.habits.length > 0 && (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700/60">
                        <tr>
                          <th className="px-4 py-3">Goal / Habit Name</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Frequency</th>
                          <th className="px-4 py-3">Target Duration</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {pr.habits.map((h, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{h.name}</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{h.category}</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{h.frequency}</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{h.target_duration_minutes} min</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                h.completed
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                              }`}>
                                {h.completed ? 'Completed' : 'Active'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* -----------------------------------------------------------------
                SECTION 5: SLEEP ANALYTICS REPORT
                ----------------------------------------------------------------- */}
            {(activeTab === "all" || activeTab === "sleep") && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-6 bg-purple-500 rounded-full" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">5. Sleep Analytics Report</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Sleep duration and sleep schedule adherence
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg border border-purple-200 dark:border-purple-500/20">
                    Schedule Adherence: {sr?.schedule_adherence_pct || 0}%
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Average Sleep Duration</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {sr?.avg_sleep_duration || 0} <span className="text-xs font-normal text-slate-400">hrs (Target: {sr?.target_duration || 8} hrs)</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Target Sleep Window</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {sr?.target_sleep_start || "22:30"} <span className="text-xs font-normal text-slate-400">to</span> {sr?.target_sleep_end || "06:30"}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Adherence Score</span>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {sr?.sleep_score || 0} <span className="text-xs font-normal text-slate-400">/ 20 pts</span>
                    </p>
                  </div>
                </div>

                {/* Sleep Log Table */}
                {sr?.logs && sr.logs.length > 0 ? (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700/60">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Target Window</th>
                          <th className="px-4 py-3">Actual Bedtime</th>
                          <th className="px-4 py-3">Actual Wake-Up</th>
                          <th className="px-4 py-3">Duration</th>
                          <th className="px-4 py-3">Adherence Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sr.logs.slice(0, 10).map((sl, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{sl.date}</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{sl.target_sleep} - {sl.target_wake}</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{sl.actual_sleep}</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{sl.actual_wake}</td>
                            <td className="px-4 py-2.5 font-semibold text-purple-600 dark:text-purple-400">{sl.duration_hours} hrs</td>
                            <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{sl.adherence_score} / 20</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 text-center text-xs text-slate-500 dark:text-slate-400 py-4">
                    No sleep logs recorded in this date range. Sleep tracking data is unavailable for the selected period.
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Bottom Action Footer */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-6 border-t border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              One unified download containing all 5 categories for the selected period.
            </div>
            <div className="flex items-center gap-3 flex-wrap shrink-0">
              <button
                id="export-pdf-bottom-btn"
                onClick={() => handleDownload('pdf')}
                disabled={loading || downloading.pdf || !reportData}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold rounded-xl whitespace-nowrap shrink-0 shadow-sm hover:shadow-md hover:shadow-rose-500/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                {downloading.pdf ? "Generating PDF..." : "Download Complete Report (PDF)"}
              </button>
              <button
                id="export-excel-bottom-btn"
                onClick={() => handleDownload('excel')}
                disabled={loading || downloading.excel || !reportData}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl whitespace-nowrap shrink-0 shadow-sm hover:shadow-md hover:shadow-emerald-500/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {downloading.excel ? "Generating Excel..." : "Download Complete Report (Excel)"}
              </button>
            </div>
          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
