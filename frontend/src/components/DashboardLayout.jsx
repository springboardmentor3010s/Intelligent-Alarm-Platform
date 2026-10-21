import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import API_URL from "../config/api";

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DashboardLayout({ title, subtitle, children }) {
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/alarms`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const alarms = await res.json();
        
        const now = new Date();
        const currentHours = now.getHours().toString().padStart(2, '0');
        const currentMinutes = now.getMinutes().toString().padStart(2, '0');
        const currentTime = `${currentHours}:${currentMinutes}`;
        const currentDay = ALL_DAYS[now.getDay()];
        
        const triggered = alarms.find(a => 
          a.is_active && 
          a.time === currentTime && 
          a.days_of_week.includes(currentDay)
        );

        if (triggered) {
          const lastTriggered = sessionStorage.getItem(`alarm_triggered_${triggered.id}`);
          if (lastTriggered !== currentTime) {
            sessionStorage.setItem(`alarm_triggered_${triggered.id}`, currentTime);
            navigate('/wake-up-challenge', { state: { alarmId: triggered.id } });
          }
        }
      } catch (err) {
        console.error("Alarm check failed", err);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [navigate, token]);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0f172a] overflow-hidden text-slate-900 dark:text-white font-sans transition-colors duration-200">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col h-screen overflow-hidden relative">
        {/* Background glow effects */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-[#6366f1]/10 to-transparent pointer-events-none -z-10"></div>
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#8b5cf6]/5 blur-[120px] rounded-full pointer-events-none -z-10"></div>
        
        <Header />
        
        <main id="main-scroll-container" tabIndex={0} className="flex-1 overflow-y-auto p-8 scroll-smooth z-0 focus:outline-none">
          <div className="max-w-[1600px] mx-auto">
            {/* Dynamic Header if passed, else handled in the page */}
            {title && (
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{title}</h1>
                {subtitle && <p className="text-slate-500 dark:text-[#cbd5e1]">{subtitle}</p>}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
