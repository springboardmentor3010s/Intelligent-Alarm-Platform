import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { Sun, Moon } from "lucide-react";

import API_URL from "../config/api";

export default function Login() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [role, setRole] = useState("user"); // "user", "admin", "coach"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [msgType, setMsgType] = useState("error");

  async function handleLogin(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setMessage("Please fill in all fields.");
      setMsgType("error");
      return;
    }
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, login_type: role }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Login failed");

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      if (data.user.role === "admin") {
        navigate("/admin-dashboard", { replace: true });
      } else if (data.user.role === "wellness_coach") {
        navigate("/coach-dashboard", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      setMessage(error.message);
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuthLogin() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/oauth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "OAuth User",
          email: "google.user@example.com",
          provider: "google",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "OAuth login failed");

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      if (data.user.role === "admin") {
        navigate("/admin-dashboard", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      setMessage(error.message);
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="absolute top-4 right-4 z-50">
        <button 
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-[#334155] text-slate-600 dark:text-[#cbd5e1] shadow-md transition-colors cursor-pointer"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
        </button>
      </div>
      {/* Left Branding Panel */}
      <div className="auth-branding">
        <div className="auth-branding-content">
          <div className="auth-branding-logo">🧠</div>
          <h1>
            Intelligent
            <br />
            Cognitive Alarm
          </h1>
          <p>
            An AI-driven alarm platform that helps you form consistent
            wake-up habits using adaptive cognitive challenges, habit tracking,
            and behavior analytics.
          </p>

          <div className="auth-features">
            <div className="auth-feature">
              <div className="auth-feature-icon">✓</div>
              <div>
                <strong>Cognitive Wake-Up Verification</strong>
                <p>Solve puzzles & riddles before dismissing alarms</p>
              </div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">✓</div>
              <div>
                <strong>Smart Habit Tracking</strong>
                <p>Track daily habits with goals, streaks & analytics</p>
              </div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">✓</div>
              <div>
                <strong>Role-Based Dashboards</strong>
                <p>Tailored dashboards for Users & Administrators</p>
              </div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">✓</div>
              <div>
                <strong>Progress & Analytics</strong>
                <p>Visual charts, streaks, and productivity insights</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Auth Card */}
      <div className="auth-card-wrapper">
        <div className="auth-card">
          <div className="auth-card-logo">🧠</div>
          <h1>Welcome Back</h1>
          <p className="auth-card-subtitle">
            Sign in to your account to continue
          </p>

          {/* Role Selection — ABOVE Google Sign-in */}
<div className="role-selector">
  <button
    id="role-tab-user"
    type="button"
    className={`role-option ${role === "user" ? "active" : ""}`}
    onClick={() => {
      setRole("user");
      setMessage("");
    }}
  >
    👤 User
  </button>

  <button
    id="role-tab-admin"
    type="button"
    className={`role-option ${role === "admin" ? "active" : ""}`}
    onClick={() => {
      setRole("admin");
      setMessage("");
    }}
  >
    ⚙️ Administrator
  </button>

  <button
    id="role-tab-coach"
    type="button"
    className={`role-option ${role === "coach" ? "active" : ""}`}
    onClick={() => {
      setRole("coach");
      setMessage("");
    }}
  >
    Wellness Coach
  </button>
</div>

{/* Error / Success Messages */}
{message && (
  <div className={`auth-alert ${msgType}`}>
    {msgType === "error" ? "⚠️" : "✅"} {message}
  </div>
)}

          {/* Login Form */}
          <form onSubmit={handleLogin} autoComplete="off">
            <div className="form-group">
              <label className="form-label" htmlFor="login-email-input">Email Address</label>
              <input 
              id="login-email-input"
              type="email"
              name="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password-input">Password</label>
              <div className="password-wrapper">
                <input 
                id="login-password-input"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Remember Me / Forgot Password */}
            <div className="auth-extras">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>
              <button type="button" className="forgot-link">
                Forgot Password?
              </button>
            </div>

            <button
              id="login-submit-button"
              className="btn btn-primary btn-full btn-lg"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : role === "admin"
                ? "Sign in as Administrator →"
                : "Sign In →"}
            </button>
          </form>

          {/* Google OAuth — BELOW role selection */}
          {role === "user" && (
            <>
              <div className="auth-divider">
                <span>OR</span>
              </div>

              <button
                className="oauth-btn"
                onClick={handleOAuthLogin}
                disabled={loading}
              >
                <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Sign in with Google
              </button>
            </>
          )}

          <p className="auth-footer">
            Don't have an account?{" "}
            <Link to="/register">Create Account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
