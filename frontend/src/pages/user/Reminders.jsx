import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import { 
  AlarmClock, 
  Bell, 
  Clock, 
  Plus, 
  Trash2, 
  Play,
  Activity,
  Edit2,
  X
} from "lucide-react";

import API_URL from "../../config/api";
const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Reminders() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");

  const [alarms, setAlarms] = useState([]);
  const [filter, setFilter] = useState("all"); // "all", "active", "inactive"
  
  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editAlarmId, setEditAlarmId] = useState(null);

  // Form state
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("07:00");
  const [alarmType, setAlarmType] = useState("Daily Alarm");
  const [days, setDays] = useState([...ALL_DAYS]);
  const [challengeType, setChallengeType] = useState("Math Problems");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [numChallenges, setNumChallenges] = useState(1);
  const [snoozeLimit, setSnoozeLimit] = useState(3);
  const [soundTone, setSoundTone] = useState("Gentle Chimes");
  const [reminderMsg, setReminderMsg] = useState("");

  async function loadAlarms() {
    try {
      const res = await fetch(`${API_URL}/alarms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setAlarms(await res.json());
      }
    } catch (err) { console.error(err); }
  }

  useEffect(() => {
    if (token) loadAlarms();
  }, [token]);

  function toggleDay(day) {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function resetForm() {
    setTitle("");
    setTime("07:00");
    setAlarmType("Daily Alarm");
    setDays([...ALL_DAYS]);
    setChallengeType("Math Problems");
    setDifficulty("Beginner");
    setNumChallenges(1);
    setSnoozeLimit(3);
    setSoundTone("Gentle Chimes");
    setReminderMsg("");
    setEditMode(false);
    setEditAlarmId(null);
  }

  function startEdit(alarm) {
    setTitle(alarm.title);
    setTime(alarm.time);
    setAlarmType(alarm.alarm_type);
    setDays(alarm.days_of_week ? alarm.days_of_week.split(',') : []);
    setChallengeType(alarm.challenge_type);
    setDifficulty(alarm.difficulty);
    setNumChallenges(alarm.num_challenges || 1);
    setSnoozeLimit(alarm.snooze_limit);
    setSoundTone(alarm.sound_tone);
    setReminderMsg(alarm.reminder_message || "");
    setEditAlarmId(alarm.id);
    setEditMode(true);
    // scroll to top to see the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    const payload = {
      title, 
      time, 
      alarm_type: alarmType, 
      days_of_week: days.join(","),
      challenge_type: challengeType, 
      difficulty, 
      snooze_limit: parseInt(snoozeLimit),
      sound_tone: soundTone, 
      is_active: true,
      reminder_message: reminderMsg,
      num_challenges: parseInt(numChallenges)
    };

    try {
      let res;
      if (editMode) {
        res = await fetch(`${API_URL}/alarms/${editAlarmId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_URL}/alarms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        loadAlarms();
        resetForm();
      }
    } catch (err) { console.error(err); }
  }

  async function toggleAlarm(id) {
    try {
      const res = await fetch(`${API_URL}/alarms/${id}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) loadAlarms();
    } catch (err) { console.error(err); }
  }

  async function deleteAlarm(id) {
    try {
      const res = await fetch(`${API_URL}/alarms/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        loadAlarms();
        if (editMode && editAlarmId === id) {
          resetForm();
        }
      }
    } catch (err) { console.error(err); }
  }

  async function triggerAlarm(id) {
    try {
      const res = await fetch(`${API_URL}/alarms/${id}/trigger`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) return;
      navigate("/wake-up-challenge", { state: { alarmId: id, soundTone: data.sound_tone || "Gentle Chimes", isTest: true } });
    } catch (err) { console.error(err); }
  }

  // Format 24h time to 12h AM/PM
  function formatAMPM(time24) {
    if (!time24) return "";
    const [h, m] = time24.split(":");
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const strHours = hours.toString().padStart(2, '0');
    return `${strHours}:${m} ${ampm}`;
  }

  const activeCount = alarms.filter(a => a.is_active).length;
  const inactiveCount = alarms.length - activeCount;

  const filteredAlarms = alarms.filter(a => {
    if (filter === "active") return a.is_active;
    if (filter === "inactive") return !a.is_active;
    return true;
  });

  // Calculate upcoming alarm
  let upcomingAlarm = null;
  if (activeCount > 0) {
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const activeAlarms = alarms.filter(a => a.is_active).sort((a, b) => a.time.localeCompare(b.time));
    upcomingAlarm = activeAlarms.find(a => a.time > currentTimeStr) || activeAlarms[0];
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 pb-10">
        
        {/* Header Section */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <AlarmClock className="w-8 h-8 text-[#6366f1]" /> Alarms
          </h1>
          <p className="text-slate-500 dark:text-[#94a3b8]">Manage your alarms. Never miss what matters!</p>
        </div>

        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#283548] transition-colors relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#ec4899]/10">
                <AlarmClock className="w-6 h-6 text-[#ec4899]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{alarms.length}</div>
                <div className="text-sm text-slate-500 dark:text-[#94a3b8]">Total Alarms</div>
                <div className="text-xs text-[#64748b] mt-0.5">{activeCount} active · {inactiveCount} inactive</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#283548] transition-colors relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#3b82f6]/10">
                <Bell className="w-6 h-6 text-[#3b82f6]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{upcomingAlarm ? '1' : '0'}</div>
                <div className="text-sm text-slate-500 dark:text-[#94a3b8]">Upcoming Alarm</div>
                <div className="text-xs text-[#64748b] mt-0.5">Next: {upcomingAlarm ? formatAMPM(upcomingAlarm.time) : 'None'}</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#283548] transition-colors relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#8b5cf6]/10">
                <Activity className="w-6 h-6 text-[#8b5cf6]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">100%</div>
                <div className="text-sm text-slate-500 dark:text-[#94a3b8]">On Time Rate</div>
                <div className="text-xs text-[#64748b] mt-0.5">This week</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Create/Edit Alarm Column (Left) */}
          <div className="lg:col-span-5 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-[#334155] flex items-center justify-between bg-slate-50 dark:bg-[#1e293b]">
              <div className="flex items-center gap-2">
                {editMode ? <Edit2 className="w-5 h-5 text-[#f59e0b]" /> : <Plus className="w-5 h-5 text-[#6366f1]" />}
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editMode ? "Edit Alarm" : "Create New Alarm"}
                </h3>
              </div>
              {editMode && (
                <button onClick={resetForm} className="text-slate-500 hover:text-slate-700 dark:text-[#cbd5e1] dark:hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase mb-2">Alarm Title</label>
                  <input
                    className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#6366f1] transition-colors"
                    value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Morning Class" required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase mb-2">Time</label>
                    <div className="flex gap-2">
                      <select
                        className="w-1/3 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg px-2 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#8b5cf6] transition-colors appearance-none text-center cursor-pointer"
                        value={String(parseInt(time.split(':')[0] || "07") % 12 || 12).padStart(2, '0')}
                        onChange={(e) => {
                          const m = time.split(':')[1] || "00";
                          const ampm = parseInt(time.split(':')[0] || "07") >= 12 ? 'PM' : 'AM';
                          let h24 = parseInt(e.target.value, 10);
                          if (ampm === 'PM' && h24 !== 12) h24 += 12;
                          if (ampm === 'AM' && h24 === 12) h24 = 0;
                          setTime(`${String(h24).padStart(2, '0')}:${m}`);
                        }}
                      >
                        {Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <span className="text-slate-500 self-center font-bold">:</span>
                      <select
                        className="w-1/3 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg px-2 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#8b5cf6] transition-colors appearance-none text-center cursor-pointer"
                        value={time.split(':')[1] || "00"}
                        onChange={(e) => {
                          const h = time.split(':')[0] || "07";
                          setTime(`${h}:${e.target.value}`);
                        }}
                      >
                        {Array.from({length: 60}, (_, i) => String(i).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select
                        className="w-1/3 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg px-2 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#8b5cf6] transition-colors appearance-none text-center cursor-pointer"
                        value={parseInt(time.split(':')[0] || "07") >= 12 ? 'PM' : 'AM'}
                        onChange={(e) => {
                          const m = time.split(':')[1] || "00";
                          let h24 = parseInt(time.split(':')[0] || "07", 10);
                          const currentAmpm = h24 >= 12 ? 'PM' : 'AM';
                          const newAmpm = e.target.value;
                          if (currentAmpm !== newAmpm) {
                            if (newAmpm === 'PM') h24 += 12;
                            else h24 -= 12;
                          }
                          setTime(`${String(h24).padStart(2, '0')}:${m}`);
                        }}
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase mb-2">Alarm Type</label>
                    <select
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#6366f1] transition-colors appearance-none"
                      value={alarmType} onChange={(e) => setAlarmType(e.target.value)}
                    >
                      <option>Daily Alarm</option>
                      <option>Weekday Alarm</option>
                      <option>Weekend Alarm</option>
                      <option>One-Time Alarm</option>
                      <option>Custom Alarm</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase mb-2">Repeat On</label>
                  <div className="flex justify-between gap-2">
                    {ALL_DAYS.map((d) => (
                      <button
                        key={d} type="button"
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                          days.includes(d) 
                            ? 'bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-white border border-[#8b5cf6]' 
                            : 'bg-slate-50 dark:bg-[#0f172a] text-slate-500 dark:text-[#94a3b8] border border-[#8b5cf6]/40 hover:border-[#8b5cf6]'
                        }`}
                        style={{
                          boxShadow: days.includes(d) ? '0 0 15px rgba(139, 92, 246, 0.5)' : '0 0 10px rgba(139, 92, 246, 0.2)'
                        }}
                        onClick={() => toggleDay(d)}
                      >
                        {d.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase mb-2">Challenge Type</label>
                    <select
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#6366f1] transition-colors appearance-none"
                      value={challengeType} onChange={(e) => setChallengeType(e.target.value)}
                    >
                      <option>Math Problems</option>
                      <option>Logic Puzzles</option>
                      <option>Memory Challenges</option>
                      <option>Word Games</option>
                      <option>Pattern Recognition</option>
                      <option>Riddles</option>
                      <option>Quick Quizzes</option>
                      <option>All Types</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase mb-2">Difficulty</label>
                    <select
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#6366f1] transition-colors appearance-none"
                      value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                      <option value="Expert">Expert</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase mb-2">Snooze Limit</label>
                    <select
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#6366f1] transition-colors appearance-none"
                      value={snoozeLimit} onChange={(e) => setSnoozeLimit(e.target.value)}
                    >
                      <option value={0}>No Snooze</option>
                      <option value={1}>1 Snooze</option>
                      <option value={3}>3 Snoozes</option>
                      <option value={5}>5 Snoozes</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase mb-2">Alarm Tone</label>
                    <select
                      className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#6366f1] transition-colors appearance-none"
                      value={soundTone} onChange={(e) => setSoundTone(e.target.value)}
                    >
                      <option>Gentle Chimes</option>
                      <option>Loud Beep</option>
                      <option>Nature Sounds</option>
                      <option>Upbeat Music</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-[#94a3b8] uppercase">Reminder Message (Optional)</label>
                    <span className="text-[10px] text-[#64748b]">{reminderMsg.length}/100</span>
                  </div>
                  <input
                    className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#6366f1] transition-colors"
                    value={reminderMsg} onChange={(e) => setReminderMsg(e.target.value)} placeholder="Time to wake up and conquer the day!" maxLength={100}
                  />
                </div>

                <button 
                  type="submit" 
                  className={`w-full mt-4 bg-slate-50 dark:bg-[#0f172a] border border-[#8b5cf6] py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-lg transition-all hover:scale-[1.02] cursor-pointer ${editMode ? 'text-[#fbbf24]' : 'text-slate-900 dark:text-white'}`}
                  style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.6)' }}
                >
                  {editMode ? <Edit2 className="w-5 h-5" /> : <span className="text-xl">⏰</span>}
                  {editMode ? "Update Alarm" : "Save Alarm"}
                </button>
              </form>
            </div>
          </div>

          {/* Scheduled Alarms Column (Right) */}
          <div className="lg:col-span-7 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-[#334155] flex justify-between items-center bg-slate-50 dark:bg-[#1e293b]">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#8b5cf6]" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Scheduled Alarms ({alarms.length})</h3>
              </div>
              <div className="flex gap-1.5 bg-slate-200 dark:bg-[#0f172a] p-1 rounded-lg">
                <button 
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${filter === 'all' ? 'bg-[#6366f1] text-white' : 'text-slate-600 dark:text-[#cbd5e1] hover:text-slate-900 dark:hover:text-white'}`}
                  onClick={() => setFilter('all')}
                >All ({alarms.length})</button>
                <button 
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${filter === 'active' ? 'bg-[#6366f1] text-white' : 'text-slate-600 dark:text-[#cbd5e1] hover:text-slate-900 dark:hover:text-white'}`}
                  onClick={() => setFilter('active')}
                >Active ({activeCount})</button>
                <button 
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${filter === 'inactive' ? 'bg-[#6366f1] text-white' : 'text-slate-600 dark:text-[#cbd5e1] hover:text-slate-900 dark:hover:text-white'}`}
                  onClick={() => setFilter('inactive')}
                >Inactive ({inactiveCount})</button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {filteredAlarms.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-[#334155] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-slate-400 dark:text-[#64748b]" />
                  </div>
                  <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No alarms found</h4>
                  <p className="text-sm text-slate-500 dark:text-[#94a3b8]">Create a new alarm using the form to get started.</p>
                </div>
              ) : (
                filteredAlarms.map((a) => (
                  <div key={a.id} className="flex flex-col bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] p-4 rounded-xl hover:border-[#6366f1]/50 transition-colors">
                    
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${a.is_active ? 'bg-[#ec4899]/10 text-[#ec4899]' : 'bg-slate-200 dark:bg-[#334155] text-slate-500 dark:text-[#94a3b8]'}`}>
                        <AlarmClock className="w-6 h-6" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-end gap-3 mb-1">
                          <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">{formatAMPM(a.time)}</span>
                          <span className="text-sm font-medium text-slate-700 dark:text-[#cbd5e1] truncate">{a.title}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-[#334155] text-slate-700 dark:text-[#cbd5e1]">{a.alarm_type}</span>
                          <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">🧩 {a.challenge_type} ({a.num_challenges || 1})</span>
                          <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded border ${
                            (a.difficulty || "Beginner") === "Beginner"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : (a.difficulty || "Beginner") === "Easy"
                              ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                              : (a.difficulty || "Beginner") === "Medium"
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              : (a.difficulty || "Beginner") === "Hard"
                              ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                              : "bg-purple-500/10 text-purple-500 border-purple-500/20"
                          }`}>
                            ⚡ {a.difficulty || "Beginner"}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-[#64748b] mt-2 font-medium">
                          {a.days_of_week}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 ml-4 border-l border-slate-200 dark:border-[#334155] pl-4 self-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={a.is_active} onChange={() => toggleAlarm(a.id)} />
                          <div className="w-11 h-6 bg-slate-200 dark:bg-[#334155] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10b981]"></div>
                        </label>
                        
                        <button 
                          className="bg-[#6366f1]/10 text-[#6366f1] hover:bg-[#6366f1]/20 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => triggerAlarm(a.id)}
                          disabled={!a.is_active}
                        >
                          <Play className="w-3 h-3" /> Test
                        </button>
                        
                        <button 
                          className="text-slate-400 hover:text-[#f59e0b] transition-colors p-1"
                          onClick={() => startEdit(a)}
                          title="Edit Alarm"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>

                        <button 
                          className="text-slate-400 hover:text-[#ef4444] transition-colors p-1"
                          onClick={() => deleteAlarm(a.id)}
                          title="Delete Alarm"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    {a.reminder_message && (
                      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-[#334155] flex items-start gap-2">
                         <span className="text-lg leading-none">📝</span>
                         <p className="text-sm text-slate-600 dark:text-[#94a3b8] italic">"{a.reminder_message}"</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}