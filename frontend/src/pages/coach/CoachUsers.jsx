import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { Users, Search, Mail, ChevronRight, Activity, CheckCircle, Clock } from "lucide-react";

import API_URL from "../../config/api";

export default function CoachUsers() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [guidanceMessage, setGuidanceMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API_URL}/coach/clients`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sendGuidance = async () => {
    if (!selectedClient || !guidanceMessage.trim()) return;
    setSending(true);
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API_URL}/coach/clients/${selectedClient.id}/guidance`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: guidanceMessage })
      });
      if (res.ok) {
        setGuidanceMessage("");
        alert("Guidance sent successfully!");
        setSelectedClient(null);
      } else {
        alert("Failed to send guidance.");
      }
    } catch (err) {
      console.error(err);
      alert("Error sending guidance.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6366f1]"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 pb-10">
        
        {/* Header Section */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <Users className="w-8 h-8 text-[#6366f1]" /> My Users
            </h1>
            <p className="text-slate-500 dark:text-[#94a3b8]">Manage and guide your assigned clients.</p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search users..." 
              className="pl-9 pr-4 py-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-lg text-sm focus:outline-none focus:border-[#6366f1]"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-4">
            {clients.length === 0 ? (
              <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-8 text-center">
                <p className="text-slate-500">No users assigned to you yet.</p>
              </div>
            ) : clients.map(client => (
              <div 
                key={client.id} 
                onClick={() => setSelectedClient(client)}
                className={`bg-white dark:bg-[#1e293b] border ${selectedClient?.id === client.id ? 'border-[#6366f1] ring-1 ring-[#6366f1]' : 'border-slate-200 dark:border-[#334155]'} rounded-xl p-5 cursor-pointer hover:border-[#6366f1] transition-all`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#6366f1]/10 flex items-center justify-center text-lg font-bold text-[#6366f1]">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{client.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-[#94a3b8] flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Preferred Wake-up: {client.preferred_wakeup_time || "Not Set"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
                
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-[#334155]/50">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Active Alarms</p>
                    <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                      <Clock className="w-4 h-4 text-[#8b5cf6]" /> {client.active_alarms}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Habit Progress</p>
                    <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-[#10b981]" /> {client.habit_progress?.completed}/{client.habit_progress?.total}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Cognitive Accuracy</p>
                    <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                      <Activity className="w-4 h-4 text-[#f59e0b]" /> {client.cognitive_accuracy}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 sticky top-6">
              {selectedClient ? (
                <>
                  <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-200 dark:border-[#334155]">
                    <div className="w-10 h-10 rounded-full bg-[#6366f1]/10 flex items-center justify-center font-bold text-[#6366f1]">
                      {selectedClient.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">Send Guidance</h3>
                      <p className="text-xs text-slate-500">To: {selectedClient.name}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-[#cbd5e1] mb-2 block">Message</label>
                      <textarea 
                        value={guidanceMessage}
                        onChange={(e) => setGuidanceMessage(e.target.value)}
                        placeholder={`Write an encouraging message or tip for ${selectedClient.name}...`}
                        className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#6366f1] h-32 resize-none"
                      ></textarea>
                    </div>
                    <button 
                      onClick={sendGuidance}
                      disabled={sending || !guidanceMessage.trim()}
                      className="w-full bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-slate-900 dark:text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      {sending ? 'Sending...' : 'Send Guidance'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-[#0f172a] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Select a Client</h3>
                  <p className="text-sm text-slate-500">Click on a user from the list to view details and send them personalized guidance.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
