import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  Home, 
  Users, 
  User,
  Bell, 
  Activity, 
  BarChart2, 
  Settings, 
  LogOut,
  BrainCircuit,
  CheckSquare,
  Shield,
  Target,
  FileText,
  MessageSquare,
  Megaphone
} from "lucide-react";

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getStoredUser();

  const isAdmin = user.role === "admin";
  const isCoach = user.role === "wellness_coach";

  const userLinks = [
    { label: "Dashboard", path: "/dashboard", icon: Home },
    { label: "Habits", path: "/habits", icon: CheckSquare },
    { label: "Alarms", path: "/reminders", icon: Bell },
    { label: "Wake-Up Challenge", path: "/wake-up-challenge", icon: BrainCircuit },
    { label: "Challenge History", path: "/challenge-history", icon: Activity },
    { label: "Cognitive Analytics", path: "/cognitive-analytics", icon: BarChart2 },
    { label: "Coach Guidance", path: "/coach-guidance", icon: MessageSquare },
    { label: "Reports", path: "/reports", icon: FileText },
    { label: "My Profile", path: "/profile", icon: Users },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  const adminLinks = [
    { label: "Dashboard", path: "/admin-dashboard", icon: Home },
    { label: "User Management", path: "/admin/users", icon: Users },
    { label: "Announcements", path: "/admin/announcements", icon: Megaphone },
    { label: "Alarms", path: "/admin/alarms", icon: Bell },
    { label: "Challenge Activity", path: "/admin/activity", icon: Activity },
    { label: "Wake-up Verification", path: "/admin/verification", icon: Target },
    { label: "Platform Analytics", path: "/admin/analytics", icon: BarChart2 },
    { label: "Reports", path: "/admin/reports", icon: FileText },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  const coachLinks = [
    { label: "Dashboard", path: "/coach-dashboard", icon: Home },
    { label: "Messages", path: "/coach/messages", icon: MessageSquare },
    { label: "My Users", path: "/coach/users", icon: Users },
    { label: "Challenge Performance", path: "/coach/performance", icon: Target },
    { label: "Wake-up Verification", path: "/coach/verification", icon: Activity },
    { label: "Challenge Analytics", path: "/coach/analytics", icon: BarChart2 },
    { label: "Reports", path: "/coach/reports", icon: FileText },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  const links = isAdmin ? adminLinks : isCoach ? coachLinks : userLinks;
  const portalName = isAdmin ? "Admin Panel" : isCoach ? "Coach Panel" : "User Panel";

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/", { replace: true });
  }

  return (
    <div className="w-64 h-screen flex flex-col bg-white dark:bg-[#0a0e1a] border-r border-slate-200 dark:border-[#1e293b] text-slate-800 dark:text-white fixed left-0 top-0 overflow-y-auto z-50 transition-colors duration-200">
      {/* Logo Area */}
      <div className="flex items-center gap-3 p-6">
        <div className="w-10 h-10 rounded-full bg-[#6366f1] flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
          <BrainCircuit className="text-white w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">CognitiveAlarm</h2>
          <p className="text-[10px] text-slate-500 dark:text-[#cbd5e1] opacity-70">Wake Smart, Live Better</p>
        </div>
      </div>

      {/* Portal Name Badge */}
      <div className="px-6 mb-6">
        <div className="bg-slate-100 dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-colors duration-200 shadow-sm">
          {isAdmin ? (
            <Shield className="w-4 h-4 text-[#6366f1]" />
          ) : isCoach ? (
            <Users className="w-4 h-4 text-[#10b981]" />
          ) : (
            <User className="w-4 h-4 text-[#6366f1]" />
          )}
          <span className="text-sm font-semibold text-slate-800 dark:text-white">{portalName}</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path || location.pathname.startsWith(link.path + '/');
          
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? "bg-[#6366f1] text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)] font-medium" 
                  : "text-slate-600 dark:text-[#cbd5e1] hover:bg-slate-100 dark:hover:bg-[#1e293b] hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 mt-auto border-t border-slate-200 dark:border-[#1e293b]">
        <div className="flex items-center justify-between px-2 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#334155] flex items-center justify-center text-sm font-bold text-slate-700 dark:text-[#f8fafc]">
              {user.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-none text-slate-900 dark:text-white">{user.name || "User"}</span>
              <span className="text-[11px] text-slate-500 dark:text-[#64748b] mt-1">{isAdmin ? "Administrator" : isCoach ? "Wellness Coach" : "User"}</span>
            </div>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-[#cbd5e1] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1e293b] rounded-xl transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
