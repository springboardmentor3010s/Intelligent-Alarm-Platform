import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { Sun, Moon } from "lucide-react";

import API_URL from "../config/api";

export default function Register() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    setName("");
    setEmail("");
    setPassword("");
    // Ensure any browser password manager autofill on mount is cleared
    const timer = setTimeout(() => {
      if (nameInputRef.current) nameInputRef.current.value = "";
      if (emailInputRef.current) emailInputRef.current.value = "";
      if (passwordInputRef.current) passwordInputRef.current.value = "";
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  async function handleRegister(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setMessage("Please fill in all fields.");
      setIsSuccess(false);
      return;
    }
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      setIsSuccess(false);
      return;
    }
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Registration failed");

      setIsSuccess(true);
      setMessage("Account created successfully! Redirecting to login...");
      setTimeout(() => navigate("/"), 1500);
    } catch (error) {
      setIsSuccess(false);
      setMessage(error.message);
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
            wake-up habits using adaptive cognitive challenges and productivity tracking.
          </p>
          <div className="auth-features">
            <div className="auth-feature">
              <div className="auth-feature-icon">✓</div>
              <div>
                <strong>Free to Get Started</strong>
                <p>Create habits, set alarms, and track your progress</p>
              </div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">✓</div>
              <div>
                <strong>Multiple Habit Categories</strong>
                <p>Health, Exercise, Study, Work, and 15+ more categories</p>
              </div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">✓</div>
              <div>
                <strong>Smart Reminders</strong>
                <p>Cognitive alarms with puzzles, riddles, and quizzes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-card-wrapper">
        <div className="auth-card">
          <div className="auth-card-logo">🧠</div>
          <h1>Create Account</h1>
          <p className="auth-card-subtitle">
            Join the Intelligent Cognitive Alarm Platform
          </p>

          {message && (
            <div className={`auth-alert ${isSuccess ? "success" : "error"}`}>
              {isSuccess ? "✅" : "⚠️"} {message}
            </div>
          )}

          <form onSubmit={handleRegister} autoComplete="off">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                ref={nameInputRef}
                type="text"
                name="register_name"
                id="register_name"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                ref={emailInputRef}
                type="email"
                name="register_email"
                id="register_email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="password-wrapper">
                <input
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  name="register_password"
                  id="register_password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
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



            <button
              className="btn btn-primary btn-full btn-lg"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account →"}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
