import { Sun, Moon } from "lucide-react";
import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import NotificationBell from "./NotificationBell";

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
}

export default function Header() {
  const user = getStoredUser();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const isAdmin = user.role === "admin";
  const isCoach = user.role === "wellness_coach";

  const today = new Date();
  const dateString = today.toLocaleDateString("en-US", { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="h-[72px] bg-white dark:bg-[#0a0e1a] border-b border-slate-200 dark:border-[#1e293b] flex items-center justify-between px-8 text-slate-800 dark:text-white z-40 sticky top-0 transition-colors duration-200">
      {/* Empty Space for alignment where search used to be */}
      <div className="flex-1 max-w-md"></div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 md:gap-6">
        {/* Date Display */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1e293b]/50 border border-slate-200 dark:border-[#334155] transition-colors duration-200">
          <span className="text-xs text-slate-600 dark:text-[#cbd5e1]">{dateString}</span>
        </div>

        {/* Reusable Role-Based Notification Bell */}
        <NotificationBell />

        {/* User Profile */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#6366f1] flex items-center justify-center text-sm font-bold text-white shadow-lg">
            {user.name ? user.name.charAt(0).toUpperCase() : (isAdmin ? "A" : isCoach ? "C" : "U")}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium">
              {isAdmin 
                ? (user.name || "Admin") 
                : isCoach 
                  ? (user.name ? (user.name.toLowerCase().startsWith("coach") ? user.name : `Coach ${user.name}`) : "Coach")
                  : (user.name || "User")}
            </div>
          </div>
        </div>

        {/* Theme Toggle */}
        <button 
          className="p-2 text-slate-500 hover:text-slate-800 dark:text-[#cbd5e1] dark:hover:text-white transition-colors"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
