import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Sparkles,
  BrainCircuit,
  CheckSquare,
  MessageSquare,
  Megaphone,
  FileText,
  Shield,
  Info,
  Award,
  X
} from "lucide-react";

import API_URL from "../config/api";

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  // Ensure UTC indicator if timezone is missing from backend ISO string
  const cleanStr = (dateString.endsWith("Z") || dateString.includes("+")) 
    ? dateString 
    : `${dateString}Z`;
  const date = new Date(cleanStr);
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now - date) / 1000));

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getCategoryConfig(category) {
  switch (category) {
    case "alarm":
      return {
        label: "Alarm",
        icon: Bell,
        color: "text-amber-500 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
        fallbackLink: "/reminders",
      };
    case "challenge":
      return {
        label: "Challenge",
        icon: BrainCircuit,
        color: "text-purple-500 dark:text-purple-400 bg-purple-500/10 border-purple-500/20",
        fallbackLink: "/wake-up-challenge",
      };
    case "habit":
      return {
        label: "Habit",
        icon: CheckSquare,
        color: "text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        fallbackLink: "/habits",
      };
    case "recommendation":
      return {
        label: "AI Recommendation",
        icon: Sparkles,
        color: "text-cyan-500 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
        fallbackLink: "/cognitive-analytics",
      };
    case "coach_recommendation":
      return {
        label: "Coach Recommendation",
        icon: Award,
        color: "text-violet-500 dark:text-violet-400 bg-violet-500/10 border-violet-500/20",
        fallbackLink: "/dashboard",
      };
    case "coach_message":
      return {
        label: "Coach Message",
        icon: MessageSquare,
        color: "text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
        fallbackLink: "/dashboard",
      };
    case "announcement":
      return {
        label: "Announcement",
        icon: Megaphone,
        color: "text-rose-500 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
        fallbackLink: "/dashboard",
      };
    case "report":
      return {
        label: "Report",
        icon: FileText,
        color: "text-blue-500 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
        fallbackLink: "/reports",
      };
    case "system":
    default:
      return {
        label: "System",
        icon: Shield,
        color: "text-slate-500 dark:text-slate-400 bg-slate-500/10 border-slate-500/20",
        fallbackLink: "/dashboard",
      };
  }
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("all"); // 'all', 'unread', 'read'
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const token = localStorage.getItem("access_token");

  // Fetch unread count & notifications
  const fetchUnreadCount = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error("Error fetching unread count:", err);
    }
  };

  const fetchNotifications = async (activeFilter = filter) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/notifications?filter=${activeFilter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  // Poll count periodically
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000);
    return () => clearInterval(interval);
  }, [token]);

  // Load notifications whenever dropdown opens or filter changes
  useEffect(() => {
    if (isOpen) {
      fetchNotifications(filter);
    }
  }, [isOpen, filter]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`${API_URL}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch(`${API_URL}/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      handleMarkAsRead(notif.id);
    }
    setIsOpen(false);

    const config = getCategoryConfig(notif.category);
    const destination = notif.link || config.fallbackLink || "/dashboard";
    navigate(destination);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-[#cbd5e1] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e293b] transition-all duration-200 focus:outline-none"
      >
        <Bell className="w-5 h-5 transition-transform active:scale-95" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-gradient-to-r from-red-500 to-rose-600 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-96 max-w-[calc(100vw-32px)] bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#1e293b] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-[#1e293b] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#6366f1]/10 text-[#6366f1] font-semibold border border-[#6366f1]/20">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:text-[#4f46e5] font-medium transition-colors p-1"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 dark:border-[#1e293b] bg-slate-50/50 dark:bg-[#131b2e]/50 px-3 pt-2 gap-1 text-xs font-medium">
            {["all", "unread", "read"].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                  filter === tab
                    ? "bg-white dark:bg-[#1e293b] text-[#6366f1] shadow-sm font-semibold"
                    : "text-slate-500 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-[#1e293b]/60">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-[#1e293b] flex items-center justify-center text-slate-400 dark:text-[#64748b] mb-3">
                  <Bell className="w-6 h-6 opacity-40" />
                </div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  No notifications yet
                </p>
                <p className="text-xs text-slate-400 dark:text-[#64748b] mt-1">
                  {filter === "unread"
                    ? "You're all caught up! No unread notifications."
                    : filter === "read"
                    ? "You have no read notifications."
                    : "Actual notifications from alarms, habits, coaches, and updates will appear here."}
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const config = getCategoryConfig(notif.category);
                const IconComponent = config.icon;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-[#1e293b]/60 cursor-pointer transition-colors ${
                      !notif.is_read
                        ? "bg-[#6366f1]/[0.03] dark:bg-[#6366f1]/[0.06]"
                        : ""
                    }`}
                  >
                    {/* Category Icon */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${config.color}`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${config.color}`}
                          >
                            {config.label}
                          </span>
                          <span
                            className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${
                              notif.priority === "urgent"
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                : notif.priority === "high"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                            }`}
                          >
                            {notif.priority === "urgent" ? "Urgent" : notif.priority === "high" ? "High" : "Normal"}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-[#64748b] flex items-center gap-1 flex-shrink-0">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(notif.created_at)}
                        </span>
                      </div>

                      <h4
                        className={`text-xs leading-snug line-clamp-1 ${
                          !notif.is_read
                            ? "font-bold text-slate-900 dark:text-white"
                            : "font-medium text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {notif.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-[#94a3b8] line-clamp-2 mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>

                    {/* Actions / Status */}
                    <div className="flex flex-col items-end justify-between self-stretch flex-shrink-0 pl-1">
                      {!notif.is_read ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-[#6366f1] ring-4 ring-[#6366f1]/20"></span>
                          <button
                            onClick={(e) => handleMarkAsRead(notif.id, e)}
                            title="Mark as read"
                            className="text-slate-400 hover:text-emerald-500 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-[#334155] transition-colors mt-auto"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-400 dark:text-[#475569] mt-auto">
                          Read
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
