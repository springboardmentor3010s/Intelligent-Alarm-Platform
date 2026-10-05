import { Outlet, Link, useLocation } from "react-router-dom";

function Layout() {
  const location = useLocation();

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    localStorage.removeItem("role");

    window.location.href = "/login";
  };

  return (
    <div className="cognia-layout">

      {/* LEFT SIDEBAR */}
      <aside className="cognia-sidebar">

        <div className="sidebar-logo">
          ?? COGNIA
        </div>

        <div className="sidebar-user">
          {localStorage.getItem("email")}
        </div>

        <nav className="cognia-nav">

          <Link
            to="/dashboard"
            className={
              location.pathname === "/dashboard"
                ? "cognia-nav-link active"
                : "cognia-nav-link"
            }
          >
            ?? Dashboard
          </Link>

          <Link
            to="/alarms"
            className={
              location.pathname === "/alarms"
                ? "cognia-nav-link active"
                : "cognia-nav-link"
            }
          >
            ? Alarms
          </Link>

          <Link
            to="/habits"
            className={
              location.pathname === "/habits"
                ? "cognia-nav-link active"
                : "cognia-nav-link"
            }
          >
            ?? Habits
          </Link>

          <Link
            to="/challenges"
            className={
              location.pathname === "/challenges"
                ? "cognia-nav-link active"
                : "cognia-nav-link"
            }
          >
            ?? Challenges
          </Link>

          <Link
            to="/analytics"
            className={
              location.pathname === "/analytics"
                ? "cognia-nav-link active"
                : "cognia-nav-link"
            }
          >
            ?? Analytics
          </Link>

          <Link
            to="/profile"
            className={
              location.pathname === "/profile"
                ? "cognia-nav-link active"
                : "cognia-nav-link"
            }
          >
            ?? Profile
          </Link>

        </nav>

        <button
          className="cognia-logout"
          onClick={logout}
        >
          ?? Logout
        </button>

      </aside>

      {/* RIGHT SIDE CONTENT */}
      <main className="cognia-main">
        <Outlet />
      </main>

    </div>
  );
}

export default Layout;

