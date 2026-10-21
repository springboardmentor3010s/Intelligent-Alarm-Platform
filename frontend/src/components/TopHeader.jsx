function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

function formatRoleName(role) {
  if (role === "admin") return "Administrator";
  if (role === "wellness_coach") return "Wellness Coach";
  return "User";
}

export default function TopHeader({ title, subtitle, onMenuToggle }) {
  const user = getStoredUser();
  const initials = (user.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="top-header">
      <div className="top-header-left">
        <button className="mobile-menu-btn" onClick={onMenuToggle}>
          ☰
        </button>
        <div className="page-title-area">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>

      <div className="top-header-right">
        <button className="header-icon-btn" title="Search">
          🔍
        </button>
        <button className="header-icon-btn" title="Notifications">
          🔔
          <span className="notif-badge"></span>
        </button>
        <div className="header-divider"></div>
        <div className="header-user">
          <div className="header-avatar">{initials}</div>
          <div className="header-user-info">
            <span className="header-user-name">{user.name || "User"}</span>
            <span className="header-user-role">
              {formatRoleName(user.role)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
