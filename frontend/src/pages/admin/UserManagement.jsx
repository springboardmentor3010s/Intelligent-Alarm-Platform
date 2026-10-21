import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";

import API_URL from "../../config/api";

function formatRoleName(role) {
  if (role === "admin") return "Administrator";
  if (role === "wellness_coach") return "Wellness Coach";
  return "User";
}

export default function UserManagement() {
  const token = localStorage.getItem("access_token");
  const [users, setUsers] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [message, setMessage] = useState("");

  // Create User State
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [creationStage, setCreationStage] = useState("select"); // 'select' | 'form'

  async function loadUsers() {
    try {
      const [usersRes, coachesRes] = await Promise.all([
        fetch(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/admin/coaches`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (coachesRes.ok) setCoaches(await coachesRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function assignCoach(userId, coachId) {
    if (!coachId) return;
    try {
      const res = await fetch(`${API_URL}/admin/coach-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: userId, coach_id: Number(coachId) }),
      });
      const data = await res.json();
      setMessage(res.ok ? "User assigned to wellness coach." : (data.detail || "Assignment failed"));
    } catch { setMessage("Assignment failed"); }
  }

  useEffect(() => { if (token) loadUsers(); }, [token]);

  async function handleRoleChange(userId, newRole) {
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update role");
      setMessage(`Updated user role to ${formatRoleName(newRole)}`);
      loadUsers();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) { setMessage(err.message); }
  }

  async function handleDeleteUser(userId) {
    if (!window.confirm("Are you sure you want to delete this user? All their data will be lost.")) return;
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to delete user");
      setMessage("User deleted successfully.");
      loadUsers();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) { setMessage(err.message); }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPassword) return;
    if (newUserPassword !== confirmPassword) {
      setMessage("Passwords do not match!");
      setTimeout(() => setMessage(""), 4000);
      return;
    }
    setCreatingUser(true);
    try {
      const res = await fetch(`${API_URL}/admin/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newUserName, email: newUserEmail, password: newUserPassword, role: newUserRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create user");
      setMessage(`Successfully created ${newUserRole} account for ${newUserName}`);
      setNewUserName(""); setNewUserEmail(""); setNewUserPassword(""); setConfirmPassword("");
      setCreationStage("select");
      setShowCreateAccount(false);
      loadUsers();
      setTimeout(() => setMessage(""), 4000);
    } catch(err) { setMessage(err.message); setTimeout(() => setMessage(""), 4000); }
    finally { setCreatingUser(false); }
  }

  const getFormTitle = (role) => {
    if (role === "admin") return "Create Admin Account";
    if (role === "wellness_coach") return "Create Coach Account";
    return "Create User Account";
  };

  const filtered = users.filter((u) => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole !== "All" && u.role !== filterRole) return false;
    return true;
  });

  return (
    <DashboardLayout title="User Management 👥" subtitle="View, search, and manage all platform users">
      {message && <div className="auth-alert success" style={{ marginBottom: 16 }}>✅ {message}</div>}

      <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] rounded-xl p-5 mb-6 transition-all duration-300">
        <button 
          onClick={() => { setShowCreateAccount(!showCreateAccount); setCreationStage("select"); }} 
          className="flex items-center justify-between w-full font-semibold text-lg text-slate-900 dark:text-white focus:outline-none"
        >
          <span>Create New Account</span>
          <span className="text-sm text-slate-500">{showCreateAccount ? "▲" : "▼"}</span>
        </button>

        {showCreateAccount && (
          <div className="mt-6 border-t border-slate-100 dark:border-[#334155] pt-5">
            {creationStage === "select" ? (
              <div className="flex flex-col">
                <p className="text-sm font-medium text-slate-700 dark:text-[#cbd5e1] mb-4">What do you want to create?</p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => { setNewUserRole("user"); setCreationStage("form"); }} className="flex flex-col text-left p-4 rounded-xl border border-slate-200 dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-[#334155]/30 transition-colors">
                    <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">👤 Create User</span>
                    <span className="text-xs text-slate-500 dark:text-[#94a3b8] mt-1">Create a normal user account</span>
                  </button>
                  <button onClick={() => { setNewUserRole("wellness_coach"); setCreationStage("form"); }} className="flex flex-col text-left p-4 rounded-xl border border-slate-200 dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-[#334155]/30 transition-colors">
                    <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">🧑‍🏫 Create Coach</span>
                    <span className="text-xs text-slate-500 dark:text-[#94a3b8] mt-1">Create a wellness coach account</span>
                  </button>
                  <button onClick={() => { setNewUserRole("admin"); setCreationStage("form"); }} className="flex flex-col text-left p-4 rounded-xl border border-slate-200 dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-[#334155]/30 transition-colors">
                    <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">🛡️ Create Admin</span>
                    <span className="text-xs text-slate-500 dark:text-[#94a3b8] mt-1">Create another administrator</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                <h3 className="text-md font-semibold text-slate-900 dark:text-white mb-4">{getFormTitle(newUserRole)}</h3>
                <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 dark:text-[#94a3b8] font-medium">Full Name</label>
                    <input type="text" required value={newUserName} onChange={e => setNewUserName(e.target.value)} className="bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none" placeholder="Jane Doe" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 dark:text-[#94a3b8] font-medium">Email Address</label>
                    <input type="email" required value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none" placeholder="jane@example.com" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 dark:text-[#94a3b8] font-medium">Password</label>
                    <input type="password" required minLength={6} value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className="bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none" placeholder="Min. 6 characters" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 dark:text-[#94a3b8] font-medium">Confirm Password</label>
                    <input type="password" required minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-[#334155] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none" placeholder="Min. 6 characters" />
                  </div>
                  <div className="col-span-1 md:col-span-2 flex justify-end gap-3 mt-2">
                    <button type="button" onClick={() => setCreationStage("select")} className="bg-slate-200 dark:bg-[#334155] hover:bg-slate-300 dark:hover:bg-[#475569] text-slate-700 dark:text-[#f8fafc] font-medium rounded-lg px-4 py-2 text-sm transition-colors">
                      Cancel
                    </button>
                    <button type="submit" disabled={creatingUser} className="bg-[#6366f1] hover:bg-[#4f46e5] text-white font-medium rounded-lg px-6 py-2 text-sm transition-colors disabled:opacity-50">
                      {creatingUser ? "Creating..." : "Create Account"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="search-bar">
        <div className="search-input-wrapper">
          <span className="search-input-icon">🔍</span>
          <input type="search" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="All">All Roles</option>
          <option value="user">User</option>
          <option value="wellness_coach">Wellness Coach</option>
          <option value="admin">Administrator</option>
        </select>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th><th>User Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No users found</td></tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id}>
                    <td>#{u.id}</td>
                    <td><strong>{u.name}</strong></td>
                    <td>{u.email}</td>
                    <td><span className={`role-badge role-${u.role}`}>{formatRoleName(u.role)}</span></td>
                    <td><span className="tag tag-success">Active</span></td>
                    <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "N/A"}</td>
                    <td style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)} style={{ fontSize: "0.82rem", padding: "6px 10px" }}>
                        <option value="user">User</option>
                        <option value="wellness_coach">Wellness Coach</option>
                        <option value="admin">Administrator</option>
                      </select>
                      {u.role === "user" && coaches.length > 0 && (
                        <select defaultValue="" onChange={(e) => assignCoach(u.id, e.target.value)} style={{ fontSize: "0.82rem", padding: "6px 10px" }}>
                          <option value="" disabled>Assign coach</option>
                          {coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}</option>)}
                        </select>
                      )}
                      <button 
                        onClick={() => handleDeleteUser(u.id)}
                        style={{ background: "#ef4444", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}
