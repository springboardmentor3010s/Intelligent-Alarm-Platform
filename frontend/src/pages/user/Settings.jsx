import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { useTheme } from "../../context/ThemeContext";
import API_URL from "../../config/api";
import { 
  Settings as SettingsIcon, 
  Palette, 
  Bell, 
  Volume2, 
  Database, 
  Save, 
  RefreshCw, 
  Trash2,
  CheckCircle2,
  Moon,
  Sun
} from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");

  const { theme, setTheme } = useTheme();
  const [notifStreak, setNotifStreak] = useState(localStorage.getItem("notif_streak") !== "false");
  const [notifGoal, setNotifGoal] = useState(localStorage.getItem("notif_goal") !== "false");
  const [notifEmail, setNotifEmail] = useState(localStorage.getItem("notif_email") === "true");
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem("sound_enabled") !== "false");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    localStorage.setItem("theme", theme);
    localStorage.setItem("app_theme", theme);
    localStorage.setItem("notif_streak", notifStreak);
    localStorage.setItem("notif_goal", notifGoal);
    localStorage.setItem("notif_email", notifEmail);
    localStorage.setItem("sound_enabled", soundEnabled);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleReset() {
    if (!window.confirm("Are you sure you want to reset all statistics?")) return;
    try {
      const res = await fetch(`${API_URL}/challenges/history/all`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) alert("Statistics reset successfully!");
      else alert("Failed to reset statistics");
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) return;
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        localStorage.clear();
        navigate("/login");
      } else {
        alert("Failed to delete account");
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 pb-10 max-w-4xl mx-auto w-full">
        
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-[#6366f1]" /> Settings
          </h1>
          <p className="text-slate-500 dark:text-[#94a3b8]">Configure your app preferences and manage your data.</p>
        </div>

        {saved && (
          <div className="bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] px-5 py-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 font-medium">
            <CheckCircle2 className="w-5 h-5" /> Settings saved successfully!
          </div>
        )}

        <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-2xl overflow-hidden shadow-lg shadow-black/10">
          
          {/* Appearance Section */}
          <div className="p-6 md:p-8 border-b border-slate-200 dark:border-[#334155]">
            <div className="flex items-center gap-2 mb-6">
              <Palette className="w-5 h-5 text-[#f59e0b]" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Appearance</h3>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-[#0f172a]/50 transition-colors">
              <div>
                <h4 className="text-slate-900 dark:text-white font-medium mb-1">Theme</h4>
                <p className="text-sm text-slate-500 dark:text-[#94a3b8]">Choose your preferred color theme</p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  id="theme-dark-btn"
                  onClick={() => setTheme("dark")}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                    theme === "dark"
                      ? "bg-[#6366f1] text-white shadow-md shadow-[#6366f1]/30"
                      : "bg-slate-100 dark:bg-[#0f172a] text-slate-700 dark:text-[#cbd5e1] border border-slate-200 dark:border-[#334155] hover:bg-slate-200 dark:hover:bg-[#1e293b]"
                  }`}
                >
                  <Moon className="w-4 h-4 text-indigo-400" /> Dark Mode
                </button>
                <button
                  type="button"
                  id="theme-light-btn"
                  onClick={() => setTheme("light")}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                    theme === "light"
                      ? "bg-[#6366f1] text-white shadow-md shadow-[#6366f1]/30"
                      : "bg-slate-100 dark:bg-[#0f172a] text-slate-700 dark:text-[#cbd5e1] border border-slate-200 dark:border-[#334155] hover:bg-slate-200 dark:hover:bg-[#1e293b]"
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-500" /> Light Mode
                </button>
              </div>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="p-6 md:p-8 border-b border-slate-200 dark:border-[#334155]">
            <div className="flex items-center gap-2 mb-6">
              <Bell className="w-5 h-5 text-[#10b981]" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Notifications</h3>
            </div>
            
            <div className="space-y-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl hover:bg-slate-50 dark:bg-[#0f172a]/50 transition-colors">
                <div>
                  <h4 className="text-slate-900 dark:text-white font-medium mb-1">Streak Alerts</h4>
                  <p className="text-sm text-slate-500 dark:text-[#94a3b8]">Celebrate streak milestones</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={notifStreak} onChange={(e) => setNotifStreak(e.target.checked)} />
                  <div className="w-11 h-6 bg-[#334155] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6366f1]"></div>
                </label>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl hover:bg-slate-50 dark:bg-[#0f172a]/50 transition-colors">
                <div>
                  <h4 className="text-slate-900 dark:text-white font-medium mb-1">Goal Updates</h4>
                  <p className="text-sm text-slate-500 dark:text-[#94a3b8]">Track goal progress notifications</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={notifGoal} onChange={(e) => setNotifGoal(e.target.checked)} />
                  <div className="w-11 h-6 bg-[#334155] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6366f1]"></div>
                </label>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl hover:bg-slate-50 dark:bg-[#0f172a]/50 transition-colors">
                <div>
                  <h4 className="text-slate-900 dark:text-white font-medium mb-1">Email Notifications</h4>
                  <p className="text-sm text-slate-500 dark:text-[#94a3b8]">Receive weekly summary via email</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={notifEmail} onChange={(e) => setNotifEmail(e.target.checked)} />
                  <div className="w-11 h-6 bg-[#334155] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6366f1]"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Sound & Alerts */}
          <div className="p-6 md:p-8 border-b border-slate-200 dark:border-[#334155]">
            <div className="flex items-center gap-2 mb-6">
              <Volume2 className="w-5 h-5 text-[#3b82f6]" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Sound & Alerts</h3>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl hover:bg-slate-50 dark:bg-[#0f172a]/50 transition-colors">
              <div>
                <h4 className="text-slate-900 dark:text-white font-medium mb-1">Alarm Sounds</h4>
                <p className="text-sm text-slate-500 dark:text-[#94a3b8]">Enable or disable alarm sound effects</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
                <div className="w-11 h-6 bg-[#334155] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6366f1]"></div>
              </label>
            </div>
          </div>

          {/* Data Management */}
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <Database className="w-5 h-5 text-[#8b5cf6]" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Data Management</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-[#0f172a]/50 rounded-xl border border-slate-200 dark:border-[#334155]/50">
                <div>
                  <h4 className="text-slate-900 dark:text-white font-medium mb-1">Reset Statistics</h4>
                  <p className="text-sm text-slate-500 dark:text-[#94a3b8]">Reset all your analytics and challenge history</p>
                </div>
                <button onClick={handleReset} className="flex items-center justify-center gap-2 bg-[#334155] hover:bg-[#475569] text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors">
                  <RefreshCw className="w-4 h-4" /> Reset
                </button>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-[#ef4444]/5 rounded-xl border border-[#ef4444]/20">
                <div>
                  <h4 className="text-[#ef4444] font-medium mb-1">Delete Account</h4>
                  <p className="text-sm text-[#ef4444]/70">Permanently delete your account and all associated data</p>
                </div>
                <button onClick={handleDelete} className="flex items-center justify-center gap-2 bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/20 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          </div>

        </div>

        <button 
          className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#6366f1]/20 mt-2 cursor-pointer" 
          onClick={handleSave}
        >
          <Save className="w-5 h-5" /> Save Settings
        </button>

      </div>
    </DashboardLayout>
  );
}
