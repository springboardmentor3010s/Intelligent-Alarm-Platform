import { useState, useEffect } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import {
  Megaphone,
  Send,
  Users,
  User,
  Shield,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  BarChart2,
  Trash2,
  Eye,
  X,
  AlertTriangle,
  Award
} from "lucide-react";

import API_URL from "../../config/api";

export default function AdminAnnouncements() {
  const token = localStorage.getItem("access_token");

  // User lists for recipient selection
  const [usersList, setUsersList] = useState([]);
  const [coachesList, setCoachesList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [recipientType, setRecipientType] = useState("all"); // 'all', 'users', 'coaches', 'user', 'coach'
  const [recipientId, setRecipientId] = useState("");
  const [priority, setPriority] = useState("normal"); // 'low', 'normal', 'high', 'urgent'

  // UI state
  const [publishing, setPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Published announcements state
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  // Details Modal
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load existing users for selection
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.filter((u) => u.role === "user"));
        setCoachesList(data.filter((u) => u.role === "wellness_coach"));
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load published announcements
  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true);
    try {
      const res = await fetch(`${API_URL}/announcements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data);
      }
    } catch (err) {
      console.error("Failed to load announcements:", err);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUsers();
      fetchAnnouncements();
    }
  }, [token]);

  // Handle publish
  const handlePublish = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!title.trim()) {
      setStatusMessage({ type: "error", text: "Please enter an announcement title." });
      return;
    }
    if (!message.trim()) {
      setStatusMessage({ type: "error", text: "Please enter announcement content." });
      return;
    }
    if ((recipientType === "user" || recipientType === "coach") && !recipientId) {
      setStatusMessage({ type: "error", text: "Please select a specific recipient." });
      return;
    }

    setPublishing(true);
    try {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        recipient_type: recipientType,
        recipient_id: (recipientType === "user" || recipientType === "coach") ? parseInt(recipientId) : null,
        priority: priority,
      };

      const res = await fetch(`${API_URL}/announcements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to publish announcement");
      }

      setStatusMessage({
        type: "success",
        text: `Announcement published successfully! Real notifications dispatched to target recipients.`,
      });

      // Reset form
      setTitle("");
      setMessage("");
      setRecipientId("");
      setRecipientType("all");
      setPriority("normal");

      // Refresh announcements
      fetchAnnouncements();
    } catch (err) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setPublishing(false);
    }
  };

  // Open details modal
  const openAnnouncementDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API_URL}/announcements/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedAnnouncement(data);
      }
    } catch (err) {
      console.error("Failed to load announcement detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Delete announcement
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this announcement and its related notifications?")) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/announcements/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
        if (selectedAnnouncement?.id === id) {
          setSelectedAnnouncement(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete announcement:", err);
    }
  };

  return (
    <DashboardLayout
      title="Platform Announcements"
      subtitle="Broadcast notifications to users, coaches, or specific accounts with real-time delivery tracking."
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ========================================================= */}
        {/* PUBLISH FORM (5 Cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-[#131b2e] rounded-2xl p-6 border border-slate-200 dark:border-[#1e293b] shadow-sm transition-colors duration-200">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-[#1e293b]">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Publish Announcement
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#94a3b8]">
                  Targeted broadcast notifications
                </p>
              </div>
            </div>

            {/* Feedback Alerts */}
            {statusMessage && (
              <div
                className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm animate-in fade-in duration-200 ${
                  statusMessage.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                    : "bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                }`}
              >
                {statusMessage.type === "success" ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <div>{statusMessage.text}</div>
              </div>
            )}

            <form onSubmit={handlePublish} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Announcement Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Platform Maintenance Window"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                />
              </div>

              {/* Recipient Scope Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Recipient Audience
                </label>
                <select
                  value={recipientType}
                  onChange={(e) => {
                    setRecipientType(e.target.value);
                    setRecipientId("");
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                >
                  <option value="all">All Platform Users (Users & Coaches)</option>
                  <option value="users">All Eligible Users Only</option>
                  <option value="coaches">All Eligible Wellness Coaches Only</option>
                  <option value="user">One Selected User</option>
                  <option value="coach">One Selected Coach</option>
                </select>
              </div>

              {/* Specific User Selection (if single user) */}
              {recipientType === "user" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Select Target User
                  </label>
                  <select
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                  >
                    <option value="">-- Choose User --</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Specific Coach Selection (if single coach) */}
              {recipientType === "coach" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Select Target Coach
                  </label>
                  <select
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                  >
                    <option value="">-- Choose Coach --</option>
                    {coachesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Notification Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "normal", label: "Normal", color: "text-blue-500" },
                    { id: "high", label: "High", color: "text-amber-500" },
                    { id: "urgent", label: "Urgent", color: "text-rose-500" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPriority(p.id)}
                      className={`py-2 px-1 rounded-xl text-xs font-semibold capitalize border transition-all ${
                        priority === p.id
                          ? "bg-[#6366f1] text-white border-[#6366f1] shadow-sm"
                          : "bg-slate-50 dark:bg-[#1e293b] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#334155]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Body */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Announcement Message
                </label>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Provide complete announcement details for the selected audience..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all resize-none"
                ></textarea>
              </div>

              {/* Publish Button */}
              <button
                type="submit"
                disabled={publishing}
                className="w-full py-3 px-4 rounded-xl bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white font-semibold text-sm shadow-[0_4px_12px_rgba(99,102,241,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {publishing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Publishing Announcement...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Publish Announcement</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ========================================================= */}
        {/* PUBLISHED ANNOUNCEMENTS TABLE (7 Cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-[#131b2e] rounded-2xl p-6 border border-slate-200 dark:border-[#1e293b] shadow-sm transition-colors duration-200">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-[#1e293b]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Published Announcements
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#94a3b8]">
                    Delivery statistics based on authentic stored notifications
                  </p>
                </div>
              </div>
              <button
                onClick={fetchAnnouncements}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e293b]"
                title="Refresh announcements list"
              >
                <RefreshCw className={`w-4 h-4 ${loadingAnnouncements ? "animate-spin" : ""}`} />
              </button>
            </div>

            {loadingAnnouncements ? (
              <div className="py-12 text-center text-sm text-slate-400">
                Loading published announcements...
              </div>
            ) : announcements.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-[#1e293b] flex items-center justify-center text-slate-400 dark:text-[#64748b] mb-3">
                  <Megaphone className="w-6 h-6 opacity-40" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No announcements published yet
                </h3>
                <p className="text-xs text-slate-400 dark:text-[#64748b] mt-1 max-w-sm mx-auto">
                  When you publish an announcement, it will be dispatched to recipients and its read rate will be tracked here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((a) => {
                  const priorityColors = {
                    urgent: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
                    high: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                    normal: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                    low: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
                  };

                  return (
                    <div
                      key={a.id}
                      className="p-4 rounded-xl border border-slate-200/80 dark:border-[#1e293b] bg-slate-50/50 dark:bg-[#0a0e1a]/40 hover:border-slate-300 dark:hover:border-[#334155] transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                priorityColors[a.priority] || priorityColors.normal
                              }`}
                            >
                              {a.priority}
                            </span>
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                              Target: {a.recipient_label}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {a.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openAnnouncementDetail(a.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-[#1e293b] dark:hover:bg-[#334155] text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>
                          <button
                            onClick={() => handleDelete(a.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                            title="Delete announcement"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-[#94a3b8] line-clamp-2 leading-relaxed">
                        {a.message}
                      </p>

                      {/* Delivery & Read Stats Progress */}
                      <div className="pt-2 border-t border-slate-200/60 dark:border-[#1e293b] flex items-center justify-between text-xs text-slate-500 dark:text-[#94a3b8] flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <span>
                            Delivered: <strong>{a.stats.delivered}</strong>
                          </span>
                          <span>
                            Read: <strong>{a.stats.read}</strong>
                          </span>
                          <span className="text-[#6366f1] font-semibold">
                            {a.stats.read_rate}% Read Rate
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-[#64748b]">
                          <Clock className="w-3 h-3" />
                          <span>
                            {a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-slate-200 dark:bg-[#1e293b] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-[#6366f1] h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${a.stats.read_rate}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ANNOUNCEMENT DETAILS MODAL */}
      {/* ========================================================= */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#131b2e] rounded-2xl max-w-2xl w-full p-6 border border-slate-200 dark:border-[#1e293b] shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#1e293b]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  {selectedAnnouncement.recipient_type.toUpperCase()} SCOPE
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {selectedAnnouncement.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0a0e1a] text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
              {selectedAnnouncement.message}
            </div>

            {/* Delivery Statistics Overview */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155]">
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedAnnouncement.stats.delivered}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-[#94a3b8] uppercase tracking-wider mt-0.5">
                  Delivered
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155]">
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedAnnouncement.stats.read}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-[#94a3b8] uppercase tracking-wider mt-0.5">
                  Read
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155]">
                <div className="text-xl font-bold text-[#6366f1]">
                  {selectedAnnouncement.stats.read_rate}%
                </div>
                <div className="text-[11px] text-slate-500 dark:text-[#94a3b8] uppercase tracking-wider mt-0.5">
                  Read Rate
                </div>
              </div>
            </div>

            {/* Recipient Breakdown List */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3">
                Recipient Delivery & Read Breakdown
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-[#1e293b] max-h-48 overflow-y-auto border border-slate-200 dark:border-[#1e293b] rounded-xl">
                {selectedAnnouncement.recipients?.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No recipients recorded.
                  </div>
                ) : (
                  selectedAnnouncement.recipients?.map((r) => (
                    <div
                      key={r.user_id}
                      className="p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {r.name}
                        </div>
                        <div className="text-slate-400 dark:text-[#64748b] text-[11px]">
                          {r.email} ({r.role})
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          r.is_read
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {r.is_read ? "Read" : "Unread"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1e293b] dark:hover:bg-[#334155] text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
