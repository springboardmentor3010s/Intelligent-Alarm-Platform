import { useState } from "react";
import { loginUser } from "../services/api";

function Login({ onLoginSuccess, onSwitchToRegister }) {
  const [email, setEmail] = useState(
    () => localStorage.getItem("remembered_login_email") || "",
  );
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(
    () => Boolean(localStorage.getItem("remembered_login_email")),
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(trimmedEmail)) {
      setError("Please enter a valid email address (e.g. name@company.com)");
      return;
    }

    setLoading(true);
    try {
      const data = await loginUser(trimmedEmail, trimmedPassword);
      if (rememberEmail) {
        localStorage.setItem("remembered_login_email", trimmedEmail);
      } else {
        localStorage.removeItem("remembered_login_email");
      }

      const token = data?.access_token || data?.token;
      if (token) {
        localStorage.setItem("access_token", token);
      }

      const safeUser = data?.user || data;
      if (safeUser) {
        localStorage.setItem("cognitive_alarm_user", JSON.stringify(safeUser));
      }

      if (onLoginSuccess) onLoginSuccess(safeUser || data);
    } catch (err) {
      const realMessage =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Unable to reach the backend service. Please ensure the server is running.";

      setError(String(realMessage));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card-saas">
        <div className="auth-header">
          <div className="auth-header-icon">🧠</div>
          <h1>Cognitive Alarm</h1>
          <p>Sign in to your adaptive morning intelligence dashboard</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Work or Personal Email</label>
            <input
              className="form-input"
              type="email"
              name="username"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(event) => setRememberEmail(event.target.checked)}
            />
            Remember my email on this device
          </label>

          {error && <div className="alert-box alert-error">⚠️ {error}</div>}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: "100%", marginTop: 8 }}
            disabled={loading}
          >
            {loading ? "Verifying Credentials..." : "Sign In to Account"}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
          Don&apos;t have an account yet?{" "}
          <button
            type="button"
            onClick={onSwitchToRegister}
            style={{
              background: "none",
              border: "none",
              color: "#818cf8",
              fontWeight: 700,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Create an account
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;