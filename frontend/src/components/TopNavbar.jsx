import { Link, useLocation, useNavigate } from "react-router-dom";

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
}

export default function TopNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getStoredUser();

  const isAdmin = user.role === "admin";
  const isCoach = user.role === "wellness_coach";

  const userLinks = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Coach", path: "/coach" },
    { label: "Habit Management", path: "/habits" },
    { label: "Alarm Management", path: "/reminders" },
    { label: "My Profile", path: "/profile" },
  ];

  const adminLinks = [
    { label: "Admin Dashboard", path: "/admin-dashboard" },
    { label: "User Management", path: "/admin/users" },
    { label: "My Profile", path: "/profile" },
  ];
  const coachLinks = [
    { label: "Coach Dashboard", path: "/coach-dashboard" },
    { label: "My Profile", path: "/profile" },
  ];

  const links = isAdmin ? adminLinks : isCoach ? coachLinks : userLinks;

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/", { replace: true });
  }

  return (
    <div style={{
      display: "flex", 
      alignItems: "center", 
      justifyContent: "space-between", 
      padding: "0 24px", 
      height: "64px", 
      background: "#6366f1", // purple from screenshot
      color: "white"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: "1.2rem" }}>🧠</span>
        <span style={{ fontWeight: "bold", fontSize: "1.2rem" }}>CognitiveAlarm</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        {links.map((link) => (
          <Link 
            key={link.path} 
            to={link.path}
            style={{ 
              color: "white", 
              textDecoration: "none", 
              fontWeight: location.pathname === link.path ? "bold" : "normal",
              opacity: location.pathname === link.path ? 1 : 0.8
            }}
          >
            {link.label}
          </Link>
        ))}
        
        {/* Role Badge */}
        <span style={{ 
          background: isAdmin ? "#ef4444" : "#10b981", 
          padding: "4px 10px", 
          borderRadius: "12px", 
          fontSize: "0.8rem", 
          fontWeight: "bold",
          marginLeft: "10px"
        }}>
          {isAdmin ? "Admin" : isCoach ? "Coach" : "User"}
        </span>

        {/* User Name */}
        <span style={{ fontSize: "0.9rem" }}>{user.name || (isAdmin ? "Administrator" : isCoach ? "Wellness Coach" : "User")}</span>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          style={{ 
            background: "rgba(255,255,255,0.2)", 
            border: "none", 
            color: "white", 
            padding: "6px 12px", 
            borderRadius: "6px",
            cursor: "pointer",
            marginLeft: "10px"
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
