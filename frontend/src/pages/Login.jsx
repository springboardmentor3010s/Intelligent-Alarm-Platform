import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import "../App.css";
import { API_BASE_URL, apiFetch } from "../api";
import { homePathFor, useAuth } from "../auth";
import ThemeToggle from "../components/ThemeToggle";

function Login() {
  const { user, login, register, loginWithToken } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  // Google sign-in returns here with #token=... (or ?error=...).
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const token = hash.get("token");

    if (query.get("error")) setError(query.get("error"));

    if (token) {
      window.history.replaceState(null, "", "/login");
      loginWithToken(token)
        .then((me) => navigate(homePathFor(me), { replace: true }))
        .catch((err) => setError(err.message));
    }
  }, []);

  useEffect(() => {
    apiFetch("/auth/oauth/providers", { auth: false })
      .then((data) => setGoogleReady(Boolean(data.google)))
      .catch(() => setGoogleReady(false));
  }, []);

  if (user) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const me =
        mode === "login"
          ? await login(email.trim(), password)
          : await register({
              full_name: fullName.trim(),
              email: email.trim(),
              password,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
            });
      navigate(homePathFor(me), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <ThemeToggle className="auth-theme-toggle" />
      <div className="auth-card">
        <div className="brand auth-brand">
          <div className="brand-icon">🧠</div>
          <div>
            <h2>Cognitive</h2>
            <span>ALARM</span>
          </div>
        </div>

        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="subtitle">
          {mode === "login"
            ? "Sign in to continue to your wake-up routine."
            : "Start building better wake-up habits."}
        </p>

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <label>
              Full name
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                maxLength={120}
                autoComplete="name"
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : 1}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            {mode === "register" && (
              <small>At least 8 characters, with a letter and a number.</small>
            )}
          </label>

          {error && <div className="challenge-error">{error}</div>}

          <button className="generate-button auth-submit" type="submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        {googleReady && (
          <>
            <div className="auth-divider"><span>or</span></div>
            <a className="auth-google" href={`${API_BASE_URL}/auth/oauth/google/login`}>
              Continue with Google
            </a>
          </>
        )}

        <p className="auth-switch">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
