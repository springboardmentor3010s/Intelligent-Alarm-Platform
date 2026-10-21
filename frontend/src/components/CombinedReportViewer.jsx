import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Activity, Clock, BrainCircuit, 
  TrendingUp, Moon, Calendar, CheckCircle2, AlertCircle, 
  RefreshCw, FileSpreadsheet, Eye, ShieldCheck, UserCheck, ChevronDown,
  Users, Award, MessageSquare, CheckCircle, Shield
} from 'lucide-react';

import API_URL from "../config/api";

export default function CombinedReportViewer({ 
  users = [], 
  title = "Combined Performance Report", 
  subtitle = "Preview all five report sections and download the consolidated PDF or Excel workbook.",
  role = "admin" // "coach" | "admin"
}) {
  const [internalUsers, setInternalUsers] = useState(users);
  const [roleFilter, setRoleFilter] = useState("all"); // "all" | "user" | "wellness_coach"
  const [selectedUserId, setSelectedUserId] = useState(users.length > 0 ? users[0].id : null);
  const [days, setDays] = useState(30);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState({ pdf: false, excel: false });
  const [reportData, setReportData] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [error, setError] = useState(null);

  // If users prop was provided, keep internalUsers in sync
  useEffect(() => {
    if (users && users.length > 0) {
      setInternalUsers(users);
    } else {
      // Auto-fetch from /reports/users
      const fetchSelectableUsers = async () => {
        const token = localStorage.getItem("access_token");
        try {
          const res = await fetch(`${API_URL}/reports/users`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setInternalUsers(data);
            if (data.length > 0 && !selectedUserId) {
              setSelectedUserId(data[0].id);
            }
          }
        } catch (err) {
          console.error("Failed to fetch selectable users for reports:", err);
        }
      };
      fetchSelectableUsers();
    }
  }, [users]);

  // Filtered users according to admin role filter
  const displayedUsers = internalUsers.filter(u => {
    if (role === "coach") return true; // Coach gets all selectable accounts from backend
    if (roleFilter === "user") return u.role === "user";
    if (roleFilter === "wellness_coach") return u.role === "wellness_coach";
    return true; // "all"
  });

  // Sync selectedUserId if displayedUsers change and selectedUserId not in list
  useEffect(() => {
    if (displayedUsers.length > 0) {
      if (!selectedUserId || !displayedUsers.some(u => u.id === selectedUserId)) {
        setSelectedUserId(displayedUsers[0].id);
      }
    }
  }, [displayedUsers, roleFilter]);

  // Fetch report data for preview
  const fetchReportData = async (targetId = selectedUserId, selectedDays = days, start = customStart, end = customEnd, custom = isCustom) => {
    if (!targetId) return;
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("access_token");
    try {
      let url = `${API_URL}/reports/data?days=${selectedDays}&user_id=${targetId}`;
      if (custom && start && end) {
        url += `&start_date=${start}&end_date=${end}`;
      }
      const response = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied: You are not authorized to view reports for this account.");
        }
        if (response.status === 404) {
          throw new Error("Selected account record was not found.");
        }
        throw new Error("Failed to load report data.");
      }
      const data = await response.json();
      setReportData(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error generating report preview");
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUserId) {
      setActiveTab("all");
      fetchReportData(selectedUserId, days, customStart, customEnd, isCustom);
    }
  }, [selectedUserId]);

  const handleGenerate = (e) => {
    e.preventDefault();
    fetchReportData(selectedUserId, days, customStart, customEnd, isCustom);
  };

  // Download complete report as PDF / Excel containing all 5 sections
  const handleDownload = async (format) => {
    if (!selectedUserId) return;
    setDownloading(prev => ({ ...prev, [format]: true }));
    const token = localStorage.getItem("access_token");
    try {
      let url = `${API_URL}/reports/export/${format}?days=${days}&type=all&user_id=${selectedUserId}`;
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
        const targetRole = reportData?.report_category === 'coach' || reportData?.user_info?.role === 'wellness_coach' ? 'Coach' : 'User';
        const accountName = reportData?.user_info?.name?.replace(/\s+/g, '_') || targetRole;
        a.download = `Complete_${targetRole}_Report_${accountName}_${days}days.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        if (response.status === 403) {
          alert("Access denied: You are not authorized to export reports for this account.");
        } else {
          alert(`Failed to download ${format.toUpperCase()} report.`);
        }
      }
    } catch (err) {
      console.error(err);
      alert(`Error during download: ${err.message}`);
    } finally {
      setDownloading(prev => ({ ...prev, [format]: false }));
    }
  };

  const isCoach = reportData?.report_category === "coach" || reportData?.user_info?.role === "wellness_coach";
  
  // User report sections
  const hr = reportData?.habit_report;
  const wr = reportData?.wakeup_report;
  const cr = reportData?.challenge_report;
  const pr = reportData?.productivity_report;
  const sr = reportData?.sleep_report;
  const userInfo = reportData?.user_info;

  // Coach report sections
  const coachProfile = reportData?.coach_profile;
  const userMgmt = reportData?.user_management;
  const coachAct = reportData?.coaching_activity;
  const progOverview = reportData?.user_progress_overview;
  const recs = reportData?.recommendations_followups;

  if (displayedUsers.length === 0 && internalUsers.length === 0) {
    return (
      <div id="combined-reports-section" className="bg-white dark:bg-[#1e293b] rounded-2xl p-8 border border-slate-200 dark:border-slate-700/60 shadow-sm text-center">
        <UserCheck className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
          {role === "coach" ? "No Users Found" : "No Accounts Available"}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
          {role === "coach" 
            ? "No users are currently registered in the platform database."
            : "No accounts match the selected role filter."
          }
        </p>
      </div>
    );
  }

  return (
    <div id="combined-reports-section" className="space-y-6">
      
      {/* =========================================================================
          CONTROL CARD: User Selector + Role Filter + Date Range + Main Download Actions
          ========================================================================= */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/60 transition-colors space-y-5">
        
        {/* Section Title */}
        <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 w-fit">
            Unified 5-in-1 Report
          </span>
        </div>

        {/* Filter Controls Row */}
        <form onSubmit={handleGenerate} className="flex flex-wrap items-center gap-3">
          
          {/* Admin Role Filter Buttons (All / Users / Coaches) */}
          {role === "admin" && (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shrink-0">
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  roleFilter === "all"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All ({internalUsers.length})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("user")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  roleFilter === "user"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Users ({internalUsers.filter(u => u.role === "user").length})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("wellness_coach")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  roleFilter === "wellness_coach"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Coaches ({internalUsers.filter(u => u.role === "wellness_coach").length})
              </button>
            </div>
          )}

          {/* Account Selector Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
              <UserCheck className="w-4 h-4 text-indigo-500" /> 
              {role === "coach" ? "Account:" : "Account:"}
            </span>
            <select
              id="report-target-user-select"
              value={selectedUserId || ""}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
              className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              {displayedUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.role === "wellness_coach" ? "[Coach] " : "[User] "}
                  {u.name} {u.email ? `(${u.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Date Range Select Buttons */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200 dark:border-slate-700/60 shrink-0">
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
                  fetchReportData(selectedUserId, opt.val, "", "", false);
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

          {/* Refresh / Generate Button */}
          <button
            type="submit"
            disabled={loading || !selectedUserId}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? "Loading..." : "Generate Preview"}
          </button>
        </form>

        {/* Dedicated Export Action Toolbar & Status Bar */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          
          {/* Selected Account Status Pill */}
          {userInfo && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-500/20">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {isCoach ? "Selected Coach" : "Selected User"}: {userInfo.name} ({userInfo.email})
              </span>
              <span>•</span>
              <span>Date Range: <strong className="text-slate-700 dark:text-slate-200">{userInfo.date_range}</strong></span>
              <span className="hidden sm:inline">•</span>
              <span className="text-slate-400">Generated: {userInfo.generated_at}</span>
            </div>
          )}

          {/* Two Main Download Options (PDF and Excel) with spacious, unclipped buttons */}
          <div className="flex items-center gap-3 flex-wrap shrink-0">
            <button
              id="export-pdf-combined-btn"
              onClick={() => handleDownload('pdf')}
              disabled={loading || downloading.pdf || !reportData}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold rounded-xl whitespace-nowrap shrink-0 shadow-sm hover:shadow-md hover:shadow-rose-500/20 transition-all disabled:opacity-50 cursor-pointer"
              title="Download complete report containing all five sections as PDF"
            >
              <Download className="w-4 h-4" />
              {downloading.pdf ? "Building PDF..." : "Download Complete Report (PDF)"}
            </button>

            <button
              id="export-excel-combined-btn"
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

      </div>

      {/* Error banner if any */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* =========================================================================
          5 SUMMARY METRIC CARDS: DYNAMICALLY ADAPTED FOR USER VS COACH
          ========================================================================= */}
      {reportData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {isCoach ? (
            <>
              {/* Coach Card 1: Coach Profile */}
              <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">1. Coach Profile</span>
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Award className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black text-slate-900 dark:text-white truncate">
                      {coachProfile?.name || "Coach"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Status: <strong className="text-emerald-600 dark:text-emerald-400">{coachProfile?.status || "Active"}</strong>
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 truncate">
                  {coachProfile?.email}
                </div>
              </div>

              {/* Coach Card 2: User Management */}
              <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">2. User Management</span>
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {userMgmt?.assigned_count ?? 0}
                    </span>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Assigned</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Active Clients: <strong className="text-slate-700 dark:text-slate-200">{userMgmt?.assigned_count ?? 0} managed</strong>
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                  {userMgmt?.assigned_count > 0 ? "Roster actively tracked" : "No clients assigned"}
                </div>
              </div>

              {/* Coach Card 3: Coaching Activity */}
              <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">3. Coaching Activity</span>
                  <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {coachAct?.total_interactions ?? 0}
                    </span>
                    <span className="text-xs font-medium text-sky-600 dark:text-sky-400">Logged</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Interactions & Consultations
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 truncate">
                  Last: {coachAct?.last_interaction ? coachAct.last_interaction.slice(0, 10) : "No activity"}
                </div>
              </div>

              {/* Coach Card 4: User Progress Overview */}
              <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">4. User Progress</span>
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {progOverview?.has_data ? `${progOverview.avg_cognitive_accuracy}%` : "No data"}
                    </span>
                    {progOverview?.has_data && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Cognitive</span>}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Habits: <strong className="text-slate-700 dark:text-slate-200">{progOverview?.has_data ? `${progOverview.habit_completion_rate}%` : "No clients"}</strong>
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                  {progOverview?.has_data ? `${progOverview.aggregate_habits_completed}/${progOverview.aggregate_habits_total} habits fulfilled` : "0 clients managed"}
                </div>
              </div>

              {/* Coach Card 5: Recommendations & Follow-ups */}
              <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">5. Recommendations</span>
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {recs?.total_recommendations ?? 0}
                    </span>
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Delivered</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Pending Follow-ups: <strong className="text-slate-700 dark:text-slate-200">{recs?.pending_followups ?? 0}</strong>
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                  {recs?.total_recommendations > 0 ? "Advisory notes active" : "No recommendations logged"}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* User Card 1: Habit Report */}
              <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
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
                  35/25/20/20 Breakdown
                </div>
              </div>

              {/* User Card 2: Wake-Up Report */}
              <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
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

              {/* User Card 3: Challenge Performance */}
              <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
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

              {/* User Card 4: Productivity Report */}
              <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
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

              {/* User Card 5: Sleep Analytics */}
              <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
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
            </>
          )}

        </div>
      )}

      {/* =========================================================================
          REPORT PREVIEW SECTION
          ========================================================================= */}
      {reportData && (
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden transition-colors">
          
          {/* Header & Dynamic Tabs */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Report Preview: {userInfo?.name} {isCoach ? "(Wellness Coach)" : ""}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isCoach 
                  ? "Preview all 5 coach sections (Profile, User Management, Activity, User Progress, Recommendations) before downloading."
                  : "Preview all 5 user sections (Habit, Wake-Up, Challenge, Productivity, Sleep) before downloading."
                }
              </p>
            </div>

            {/* Category tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
              {isCoach ? (
                [
                  { id: "all", label: "All 5 Sections" },
                  { id: "profile", label: "1. Profile" },
                  { id: "management", label: "2. User Mgmt" },
                  { id: "activity", label: "3. Activity" },
                  { id: "progress", label: "4. User Progress" },
                  { id: "recommendations", label: "5. Recommendations" },
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
                ))
              ) : (
                [
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
                ))
              )}
            </div>
          </div>

          <div className="p-6 space-y-10">
            
            {/* =============================================================
                COACH REPORT CONTENT (WHEN COACH IS SELECTED)
                ============================================================= */}
            {isCoach ? (
              <>
                {/* 1. COACH PROFILE */}
                {(activeTab === "all" || activeTab === "profile") && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-6 bg-indigo-500 rounded-full" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">1. Coach Profile</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Coach identity, verified email address, account standing, and credentials
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
                        Status: {coachProfile?.status || "Active"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Coach Name</span>
                        <p className="text-base font-bold text-slate-900 dark:text-white mt-1">{coachProfile?.name}</p>
                        <span className="text-[11px] text-slate-400">Registered Platform Name</span>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Email Address</span>
                        <p className="text-base font-bold text-slate-900 dark:text-white mt-1 truncate">{coachProfile?.email}</p>
                        <span className="text-[11px] text-slate-400">Primary Contact Channel</span>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Account Status</span>
                        <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4" /> {coachProfile?.status || "Active"}
                        </p>
                        <span className="text-[11px] text-slate-400">Verified Platform Standing</span>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Role Designation</span>
                        <p className="text-base font-bold text-slate-900 dark:text-white mt-1">{coachProfile?.role || "Wellness Coach"}</p>
                        <span className="text-[11px] text-slate-400">Authorized Coach Clearance</span>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Joined Platform</span>
                        <p className="text-base font-bold text-slate-900 dark:text-white mt-1">{coachProfile?.joined_at || "2026-09-10"}</p>
                        <span className="text-[11px] text-slate-400">Registration Date</span>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Client Assignments</span>
                        <p className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-1">{userMgmt?.assigned_count ?? 0} assigned</p>
                        <span className="text-[11px] text-slate-400">{coachProfile?.specialization}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. USER MANAGEMENT */}
                {(activeTab === "all" || activeTab === "management") && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-6 bg-emerald-500 rounded-full" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">2. User Management</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Number of users assigned to the coach and active client roster
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
                        Total Clients: {userMgmt?.assigned_count ?? 0}
                      </span>
                    </div>

                    {userMgmt?.assigned_users && userMgmt.assigned_users.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700/60">
                            <tr>
                              <th className="px-4 py-3">Client ID</th>
                              <th className="px-4 py-3">Client Name</th>
                              <th className="px-4 py-3">Email Address</th>
                              <th className="px-4 py-3">Assigned Date</th>
                              <th className="px-4 py-3">Account Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {userMgmt.assigned_users.map((client, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">#{client.id}</td>
                                <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                                    {client.name.slice(0, 1).toUpperCase()}
                                  </div>
                                  {client.name}
                                </td>
                                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{client.email}</td>
                                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{client.assigned_at}</td>
                                <td className="px-4 py-2.5">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                    {client.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 text-center text-xs text-slate-500 dark:text-slate-400">
                        No clients are currently assigned to this coach. When users are assigned via the Admin User Management panel, they will appear in this roster.
                      </div>
                    )}
                  </div>
                )}

                {/* 3. COACHING ACTIVITY */}
                {(activeTab === "all" || activeTab === "activity") && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-6 bg-sky-500 rounded-full" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">3. Coaching Activity</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Coaching sessions, follow-ups, and recorded client interactions
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-lg border border-sky-200 dark:border-sky-500/20">
                        Interactions: {coachAct?.total_interactions ?? 0}
                      </span>
                    </div>

                    {coachAct?.activities && coachAct.activities.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700/60">
                            <tr>
                              <th className="px-4 py-3">Date & Time</th>
                              <th className="px-4 py-3">Client Name</th>
                              <th className="px-4 py-3">Activity Type</th>
                              <th className="px-4 py-3">Details / Session Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {coachAct.activities.map((act, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">{act.created_at}</td>
                                <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{act.user_name}</td>
                                <td className="px-4 py-2.5 text-sky-600 dark:text-sky-400 font-semibold">{act.activity_type}</td>
                                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{act.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 text-center text-xs text-slate-500 dark:text-slate-400">
                        No coaching sessions, follow-ups, or direct interactions recorded in this period.
                      </div>
                    )}
                  </div>
                )}

                {/* 4. USER PROGRESS OVERVIEW */}
                {(activeTab === "all" || activeTab === "progress") && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-6 bg-amber-500 rounded-full" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">4. User Progress Overview</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Aggregate progress of users the coach is authorized to manage
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-500/20">
                        Managed Clients: {progOverview?.total_clients ?? 0}
                      </span>
                    </div>

                    {progOverview?.has_data ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Habit Completion Progress</span>
                            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                              {progOverview.habit_completion_rate}%
                            </p>
                            <span className="text-[11px] text-slate-400">
                              {progOverview.aggregate_habits_completed} of {progOverview.aggregate_habits_total} habits fulfilled
                            </span>
                          </div>
                          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Avg Cognitive Accuracy</span>
                            <p className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-1">
                              {progOverview.avg_cognitive_accuracy}%
                            </p>
                            <span className="text-[11px] text-slate-400">Challenge solve success rate</span>
                          </div>
                          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Wake-Up Verification Rate</span>
                            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                              {progOverview.wake_verification_rate}%
                            </p>
                            <span className="text-[11px] text-slate-400">On-time verified wake-ups</span>
                          </div>
                          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Total Active Alarms</span>
                            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                              {progOverview.total_active_alarms}
                            </p>
                            <span className="text-[11px] text-slate-400">Active morning alarms</span>
                          </div>
                        </div>

                        {progOverview.clients && progOverview.clients.length > 0 && (
                          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700/60">
                                <tr>
                                  <th className="px-4 py-3">Client Name</th>
                                  <th className="px-4 py-3">Email Address</th>
                                  <th className="px-4 py-3">Habits Progress</th>
                                  <th className="px-4 py-3">Cognitive Accuracy</th>
                                  <th className="px-4 py-3">Wake Verification</th>
                                  <th className="px-4 py-3">Active Alarms</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {progOverview.clients.map((c, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                    <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{c.name}</td>
                                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{c.email}</td>
                                    <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                                      {c.habits_completed} / {c.habits_total} ({c.habit_completion_rate}%)
                                    </td>
                                    <td className="px-4 py-2.5 text-sky-600 dark:text-sky-400 font-bold">{c.cognitive_accuracy}%</td>
                                    <td className="px-4 py-2.5 text-emerald-600 dark:text-emerald-400 font-bold">{c.wake_verification_rate}%</td>
                                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{c.active_alarms}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 text-center text-xs text-slate-500 dark:text-slate-400">
                        No assigned clients available to aggregate progress metrics.
                      </div>
                    )}
                  </div>
                )}

                {/* 5. RECOMMENDATIONS & FOLLOW-UPS */}
                {(activeTab === "all" || activeTab === "recommendations") && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-6 bg-purple-500 rounded-full" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">5. Recommendations & Follow-ups</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Recommendations provided and pending follow-ups
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg border border-purple-200 dark:border-purple-500/20">
                        Total: {recs?.total_recommendations ?? 0}
                      </span>
                    </div>

                    {recs?.recommendations && recs.recommendations.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700/60">
                            <tr>
                              <th className="px-4 py-3">Date & Time</th>
                              <th className="px-4 py-3">Target Client</th>
                              <th className="px-4 py-3">Recommendation / Advice</th>
                              <th className="px-4 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {recs.recommendations.map((r, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{r.date}</td>
                                <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{r.client_name}</td>
                                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{r.recommendation}</td>
                                <td className="px-4 py-2.5">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                    {r.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 text-center text-xs text-slate-500 dark:text-slate-400">
                        No recommendations or pending follow-up notes recorded for this coach.
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* =============================================================
                    USER REPORT CONTENT (WHEN USER IS SELECTED)
                    ============================================================= */}
                {/* 1. HABIT REPORT */}
                {(activeTab === "all" || activeTab === "habit") && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-6 bg-indigo-500 rounded-full" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">1. Habit Report</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Cognitive Habit Score ({hr?.habit_score || 0}/100) & 35/25/20/20 Pillar Distribution
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-500/20">
                        Score: {hr?.habit_score || 0} / 100
                      </span>
                    </div>

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

                {/* 2. WAKE-UP REPORT */}
                {(activeTab === "all" || activeTab === "wakeup") && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-6 bg-emerald-500 rounded-full" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">2. Wake-Up Report</h4>
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

                {/* 3. CHALLENGE PERFORMANCE REPORT */}
                {(activeTab === "all" || activeTab === "challenge") && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-6 bg-sky-500 rounded-full" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">3. Challenge Performance Report</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Cognitive accuracy, solve times, and challenge distribution
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-lg border border-sky-200 dark:border-sky-500/20">
                        Accuracy: {cr?.success_rate || 0}%
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Cognitive Accuracy</span>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                          {cr?.correct_attempts || 0} <span className="text-xs font-normal text-slate-400">/ {cr?.total_attempts || 0} correct</span>
                        </p>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Average Solve Time</span>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                          {cr?.avg_solve_time || 0} <span className="text-xs font-normal text-slate-400">seconds</span>
                        </p>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Total Attempts</span>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                          {cr?.total_attempts || 0} <span className="text-xs font-normal text-slate-400">logged</span>
                        </p>
                      </div>
                    </div>

                    {cr?.breakdown_by_type && Object.keys(cr.breakdown_by_type).length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                        {Object.entries(cr.breakdown_by_type).map(([ctype, stats]) => (
                          <div key={ctype} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50/30 dark:bg-slate-900/20">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">{ctype}</span>
                            <div className="flex items-center justify-between text-xs mt-1">
                              <span className="text-slate-500 dark:text-slate-400">{stats.accuracy}% accuracy</span>
                              <span className="text-slate-400">{stats.avg_time}s avg</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. PRODUCTIVITY REPORT */}
                {(activeTab === "all" || activeTab === "prod") && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-6 bg-amber-500 rounded-full" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">4. Productivity Report</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Goal fulfillment, habit consistency, and daily productivity routines
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-500/20">
                        Completion: {pr?.completion_rate || 0}%
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Productivity Goals</span>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-1">
                        {pr?.productivity_goals_text || "No custom productivity goals logged"}
                      </p>
                    </div>

                    {pr?.habits && pr.habits.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
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
                                <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{h.name}</td>
                                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{h.category}</td>
                                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{h.frequency}</td>
                                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{h.target_duration_minutes} min</td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    h.completed 
                                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                  }`}>
                                    {h.completed ? "Completed" : "Active"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 text-center text-xs text-slate-500 dark:text-slate-400">
                        No habits or productivity goals recorded for this account.
                      </div>
                    )}
                  </div>
                )}

                {/* 5. SLEEP ANALYTICS REPORT */}
                {(activeTab === "all" || activeTab === "sleep") && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-6 bg-purple-500 rounded-full" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">5. Sleep Analytics Report</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Sleep schedules, bedtime consistency, and schedule adherence
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg border border-purple-200 dark:border-purple-500/20">
                        Adherence: {sr?.schedule_adherence_pct || 0}%
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
                        No sleep logs recorded in this date range.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

          </div>

          {/* Bottom Action Footer with Clean Download Options */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-6 border-t border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              One unified download containing all 5 categories for <strong>{userInfo?.name}</strong>.
            </div>
            <div className="flex items-center gap-3 flex-wrap shrink-0">
              <button
                id="export-pdf-bottom-combined-btn"
                onClick={() => handleDownload('pdf')}
                disabled={loading || downloading.pdf || !reportData}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold rounded-xl whitespace-nowrap shrink-0 shadow-sm hover:shadow-md hover:shadow-rose-500/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                {downloading.pdf ? "Generating PDF..." : "Download Complete Report (PDF)"}
              </button>
              <button
                id="export-excel-bottom-combined-btn"
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
      )}

    </div>
  );
}
