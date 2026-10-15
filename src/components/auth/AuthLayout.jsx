import "../../styles/auth.css";
import { useTheme } from "../../context/ThemeContext";

function AuthLayout({ title, children }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="auth-container">
      <div className="auth-top-bar">
        <button
          type="button"
          className="theme-toggle-btn auth-theme-toggle"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to Light Mode (☀️)" : "Switch to Dark Mode (🌙)"}
          aria-label="Toggle theme"
        >
          <span>{theme === "dark" ? "☀️" : "🌙"}</span>
        </button>
      </div>

      <div className="auth-card">
        <h1>Intelligent Cognitive Alarm</h1>

        <h2>{title}</h2>

        {children}
      </div>
    </div>
  );
}

export default AuthLayout;