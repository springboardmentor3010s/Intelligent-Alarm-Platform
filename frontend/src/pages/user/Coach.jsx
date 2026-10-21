import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { MessageSquare, Award, Clock, User, CheckCircle, Sparkles } from "lucide-react";

import API_URL from "../../config/api";

export default function Coach() {
  const token = localStorage.getItem("access_token");
  const [alarms, setAlarms] = useState([]);
  const [habits, setHabits] = useState([]);
  const [messages, setMessages] = useState([]);
  const [guidance, setGuidance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [alarmRes, habitRes, messagesRes, guidanceRes] = await Promise.all([
          fetch(`${API_URL}/alarms`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/habits`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/messages/received`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/coach/my-guidance`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (alarmRes.ok) setAlarms(await alarmRes.json());
        if (habitRes.ok) setHabits(await habitRes.json());
        if (messagesRes.ok) setMessages(await messagesRes.json());
        if (guidanceRes.ok) setGuidance(await guidanceRes.json());
      } catch (err) {
        console.error("Coach report load error:", err);
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token]);

  const activeAlarms = alarms.filter((a) => a.is_active);
  const completedHabits = habits.filter((h) => h.completed);
  const pendingHabits = habits.filter((h) => !h.completed);
  const completionRate = habits.length > 0 ? Math.round((completedHabits.length / habits.length) * 100) : 0;

  // Generate dynamic coach message
  let coachGreeting = "Let's review your progress!";
  if (completionRate >= 80) coachGreeting = "Amazing work! You're crushing your goals.";
  else if (completionRate >= 50) coachGreeting = "You're on the right track. Let's finish strong!";
  else if (habits.length > 0) coachGreeting = "It's time to step it up! Focus on one habit at a time.";

  return (
    <DashboardLayout 
      title="Wellness Coach Guidance" 
      subtitle="Direct messages, personalized recommendations, and coaching insights from your wellness coach."
    >
      {loading ? (
        <div className="py-12 text-center text-slate-400">Loading coaching insights...</div>
      ) : (
        <div className="space-y-8">
          {/* Top Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Main Coach Feedback */}
            <div className="bg-white dark:bg-[#131b2e] rounded-2xl p-6 border border-slate-200 dark:border-[#1e293b] shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-[#1e293b]">
                <Sparkles className="w-5 h-5 text-[#6366f1]" />
                <h3 className="font-bold text-slate-900 dark:text-white">Coach's Daily Assessment</h3>
              </div>
              <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 space-y-3">
                <p className="font-semibold text-base text-slate-900 dark:text-white">{coachGreeting}</p>
                <p>
                  Currently, you have <strong className="text-slate-900 dark:text-white">{activeAlarms.length} active alarms</strong> scheduled.
                  You are tracking <strong className="text-slate-900 dark:text-white">{habits.length} habits</strong> in total, with <strong className="text-slate-900 dark:text-white">{completedHabits.length} completed</strong> so far today.
                </p>
                <div className="w-full bg-slate-100 dark:bg-[#1e293b] rounded-full h-2 overflow-hidden mt-3">
                  <div className="bg-[#6366f1] h-2 rounded-full" style={{ width: `${completionRate}%` }}></div>
                </div>
                <div className="text-xs text-slate-400 text-right">{completionRate}% habit completion</div>
              </div>
            </div>

            {/* Actionable Report */}
            <div className="bg-white dark:bg-[#131b2e] rounded-2xl p-6 border border-slate-200 dark:border-[#1e293b] shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-[#1e293b]">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">Actionable Checkpoints</h3>
              </div>
              <ul className="text-xs space-y-2.5 text-slate-600 dark:text-slate-300">
                {activeAlarms.length === 0 ? (
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></span>
                    <span><strong>Alarm Alert:</strong> You have no active alarms! Set a consistent wake-up time in Alarms.</span>
                  </li>
                ) : (
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                    <span><strong>Alarm Check:</strong> Your alarms are active and consistent.</span>
                  </li>
                )}
                {habits.length === 0 ? (
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></span>
                    <span><strong>Habit Check:</strong> Start small by adding a 5-minute morning routine habit.</span>
                  </li>
                ) : pendingHabits.length > 0 ? (
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0"></span>
                    <span><strong>Habit Focus:</strong> You have {pendingHabits.length} habits pending today. Pick one to complete next!</span>
                  </li>
                ) : (
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                    <span><strong>Habit Success:</strong> You've completed all scheduled habits for today!</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></span>
                  <span><strong>Consistency:</strong> Maintain your sleep window to optimize challenge performance tomorrow.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Coach Recommendations */}
          <div className="bg-white dark:bg-[#131b2e] rounded-2xl p-6 border border-slate-200 dark:border-[#1e293b] shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-[#1e293b]">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Personalized Coaching Recommendations</h3>
                <p className="text-xs text-slate-500 dark:text-[#94a3b8]">Verified guidance and actionable steps from your assigned wellness coach</p>
              </div>
            </div>

            {messages.length === 0 && guidance.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-[#1e293b] flex items-center justify-center text-slate-400 mb-3">
                  <Award className="w-6 h-6 opacity-40 text-violet-500" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No recommendations from your coach yet</p>
                <p className="text-xs text-slate-400 dark:text-[#64748b] mt-1 max-w-sm mx-auto">
                  When your wellness coach sends you personalized coaching recommendations, they will appear here and in your notification center.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Formal Coach Messages */}
                {messages.map((m) => {
                  return (
                    <div
                      key={m.id}
                      className="p-5 rounded-xl border border-slate-200 dark:border-[#1e293b] bg-slate-50/50 dark:bg-[#0a0e1a]/40 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20"
                          >
                            Coaching Recommendation
                          </span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            From: {m.coach_name}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {m.subject}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-[#94a3b8] leading-relaxed whitespace-pre-wrap">
                        {m.body}
                      </p>
                    </div>
                  );
                })}

                {/* Legacy Guidance records if any exist without CoachMessage */}
                {guidance
                  .filter((g) => !messages.some((m) => m.body === g.message || `[${m.subject}] ${m.body}` === g.message))
                  .map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-[#1e293b] bg-slate-50/50 dark:bg-[#0a0e1a]/40 text-xs text-slate-700 dark:text-slate-300"
                    >
                      <div className="font-semibold text-[11px] text-slate-400 mb-1">
                        Guidance note:
                      </div>
                      <div>{item.message}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
