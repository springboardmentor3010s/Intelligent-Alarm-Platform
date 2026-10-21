import { useState, useEffect } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import {
  Send,
  MessageSquare,
  Award,
  Users,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Mail,
  ShieldAlert
} from "lucide-react";

import API_URL from "../../config/api";

export default function CoachMessages() {
  const token = localStorage.getItem("access_token");

  // Assigned Clients State
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Form State
  const [recipientScope, setRecipientScope] = useState("single"); // 'single' or 'all_assigned'
  const [selectedClientId, setSelectedClientId] = useState("");
  const messageType = "recommendation"; // Strictly coaching recommendations
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // UI / Status State
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success'|'error', text: '' }

  // Sent History State
  const [sentMessages, setSentMessages] = useState([]);
  const [loadingSent, setLoadingSent] = useState(true);

  // Fetch assigned clients
  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const res = await fetch(`${API_URL}/coach/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
        if (data.length > 0) {
          setSelectedClientId(data[0].id.toString());
        }
      }
    } catch (err) {
      console.error("Failed to load assigned clients:", err);
    } finally {
      setLoadingClients(false);
    }
  };

  // Fetch sent messages
  const fetchSentMessages = async () => {
    setLoadingSent(true);
    try {
      const res = await fetch(`${API_URL}/messages/sent`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSentMessages(data);
      }
    } catch (err) {
      console.error("Failed to load sent messages:", err);
    } finally {
      setLoadingSent(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchClients();
      fetchSentMessages();
    }
  }, [token]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    if (recipientScope === "single" && !selectedClientId) {
      setStatusMessage({ type: "error", text: "Please select an assigned recipient." });
      return;
    }
    if (!subject.trim()) {
      setStatusMessage({ type: "error", text: "Please enter a subject line." });
      return;
    }
    if (!body.trim()) {
      setStatusMessage({ type: "error", text: "Please enter the message content." });
      return;
    }

    setSending(true);
    try {
      const payload = {
        recipient_type: recipientScope,
        recipient_id: recipientScope === "single" ? parseInt(selectedClientId) : null,
        message_type: messageType,
        subject: subject.trim(),
        body: body.trim(),
      };

      const res = await fetch(`${API_URL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to send message");
      }

      setStatusMessage({
        type: "success",
        text: recipientScope === "all_assigned"
          ? `Successfully sent ${messageType === 'recommendation' ? 'coaching recommendations' : 'messages'} to all ${clients.length} assigned clients.`
          : `Message sent successfully to client. Notification dispatched.`,
      });

      // Reset form fields
      setSubject("");
      setBody("");

      // Refresh sent history
      fetchSentMessages();
    } catch (err) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout
      title="Coach Recommendations"
      subtitle="Send actionable coaching recommendations to your assigned clients."
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ========================================================= */}
        {/* COMPOSE SECTION (5 Cols on Large screens) */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-[#131b2e] rounded-2xl p-6 border border-slate-200 dark:border-[#1e293b] shadow-sm transition-colors duration-200">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-[#1e293b]">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Send Coaching Recommendation
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#94a3b8]">
                  Actionable guidance dispatched to client dashboard
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

            {/* If no clients assigned */}
            {!loadingClients && clients.length === 0 ? (
              <div className="p-6 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-400 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <ShieldAlert className="w-4 h-4" />
                  <span>No Clients Assigned</span>
                </div>
                <p className="text-xs leading-relaxed">
                  You currently have no users assigned to your coach account. Under strict authorization rules, coaches can only message users explicitly assigned to them by an administrator.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="space-y-5">
                {/* Recipient Scope Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Recipient Scope
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRecipientScope("single")}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        recipientScope === "single"
                          ? "bg-[#6366f1] text-white border-[#6366f1] shadow-sm"
                          : "bg-slate-50 dark:bg-[#1e293b] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#334155] hover:border-slate-300"
                      }`}
                    >
                      <User className="w-4 h-4" />
                      <span>One Client</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipientScope("all_assigned")}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        recipientScope === "all_assigned"
                          ? "bg-[#6366f1] text-white border-[#6366f1] shadow-sm"
                          : "bg-slate-50 dark:bg-[#1e293b] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#334155] hover:border-slate-300"
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>All Assigned ({clients.length})</span>
                    </button>
                  </div>
                </div>

                {/* Specific Client Dropdown (if single) */}
                {recipientScope === "single" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Select Client
                    </label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Recommendation Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Morning Routine Consistency Plan"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all"
                  />
                </div>

                {/* Message Body */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Recommendation Details & Action Steps
                  </label>
                  <textarea
                    rows={6}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write your actionable coaching recommendation and guidance steps here..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] transition-all resize-none"
                  ></textarea>
                </div>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold text-sm shadow-[0_4px_12px_rgba(139,92,246,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {sending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Dispatching Recommendation...</span>
                    </>
                  ) : (
                    <>
                      <Award className="w-4 h-4" />
                      <span>Send Coaching Recommendation</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* SENT HISTORY SECTION (7 Cols on Large screens) */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-[#131b2e] rounded-2xl p-6 border border-slate-200 dark:border-[#1e293b] shadow-sm transition-colors duration-200">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-[#1e293b]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Sent Coaching Recommendations
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#94a3b8]">
                    History of recommendations dispatched by you
                  </p>
                </div>
              </div>
              <button
                onClick={fetchSentMessages}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-[#1e293b]"
                title="Refresh sent history"
              >
                <RefreshCw className={`w-4 h-4 ${loadingSent ? "animate-spin" : ""}`} />
              </button>
            </div>

            {loadingSent ? (
              <div className="py-12 text-center text-sm text-slate-400">
                Loading sent history...
              </div>
            ) : sentMessages.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-[#1e293b] flex items-center justify-center text-slate-400 dark:text-[#64748b] mb-3">
                  <Award className="w-6 h-6 opacity-40 text-violet-500" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No recommendations sent yet
                </h3>
                <p className="text-xs text-slate-400 dark:text-[#64748b] mt-1 max-w-sm mx-auto">
                  When you send a coaching recommendation to your assigned clients, it will appear here with delivery details.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sentMessages.map((msg) => {
                  return (
                    <div
                      key={msg.id}
                      className="p-4 rounded-xl border border-slate-200/80 dark:border-[#1e293b] bg-slate-50/50 dark:bg-[#0a0e1a]/40 hover:border-slate-300 dark:hover:border-[#334155] transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20"
                          >
                            Coaching Recommendation
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            To: {msg.recipient_name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-[#64748b]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {msg.created_at ? new Date(msg.created_at).toLocaleString() : "Recently"}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium border border-emerald-500/20 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Delivered
                          </span>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {msg.subject}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-[#94a3b8] leading-relaxed whitespace-pre-wrap">
                        {msg.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
