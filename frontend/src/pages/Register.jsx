import React, { useState } from "react";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import Logo from "../components/Logo";
import RoleBadge from "../components/RoleBadge";
import api from "../services/api";


function Register({ role = "USER", onBackToLogin, onLoginSuccess }) {
  const targetRole = (role || "USER").toUpperCase();

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirm_password: "",
    timezone: "Asia/Kolkata",
    security_code: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (targetRole !== "USER" && !form.security_code.trim()) {
      setError(`Authorization Security Code is required for ${targetRole} registration.`);
      return;
    }

    try {
      setLoading(true);

      const payload = {
        name: form.name.trim(),
        username: form.username.trim() || form.email.split("@")[0],
        email: form.email.trim(),
        password: form.password.trim(),
        confirm_password: form.confirm_password.trim(),
        timezone: form.timezone,
        role: targetRole,
        security_code: form.security_code.trim(),
      };

      await api.post("/auth/register", payload);

      setSuccess(`Account created successfully with role ${targetRole}! Redirecting to login...`);

      // If registering as USER, try auto-login or redirect to login after short delay
      setTimeout(async () => {
        if (targetRole === "USER" && onLoginSuccess) {
          try {
            const loginRes = await api.post("/auth/login", {
              email: form.email.trim(),
              password: form.password.trim(),
              role: "USER"
            });
            const token = loginRes.data.access_token;
            localStorage.setItem("token", token);
            onLoginSuccess(token);
            return;
          } catch (loginErr) {
            console.error(loginErr);
          }
        }
        if (onBackToLogin) onBackToLogin();
      }, 1200);

    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Registration failed. Please verify your details and try again."
      );
      // Do not retain personal or password information after a failed signup.
      setForm({
        name: "",
        username: "",
        email: "",
        password: "",
        confirm_password: "",
        timezone: "Asia/Kolkata",
        security_code: "",
      });
      setShowPassword(false);
      setShowConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  const titleMap = {
    USER: "Create User Account",
    WELLNESS_COACH: "Create Wellness Coach Account",
    ADMIN: "Create Admin Account",
  };

  return (
    <div
      className="register-page"
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 50% 30%, rgba(139, 92, 246, 0.15) 0%, transparent 60%), linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "30px 20px",
        fontFamily: "Inter, sans-serif"
      }}
    >
      <div
        className="register-card"
        style={{
          width: "100%",
          maxWidth: 480,
          background: "rgba(30, 41, 59, 0.85)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 24,
          padding: "32px 28px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)"
        }}
      >
        {/* TOP BRANDING & TITLE */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <Logo size="md" showSubtitle={false} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px", color: "#ffffff" }}>
            {titleMap[targetRole] || "Create Account"}
          </h1>
          <div style={{ display: "inline-block", marginTop: 4 }}>
            <RoleBadge role={targetRole} />
          </div>
        </div>

        {/* ERROR / SUCCESS NOTIFICATIONS */}
        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#6ee7b7", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
            {success}
          </div>
        )}

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* FULL NAME */}
          <div className="form-control">
            <label>Full Name</label>
            <input
              type="text"
              placeholder="e.g. Tharunya Manokaran"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              required
            />
          </div>

          {/* USERNAME */}
          <div className="form-control">
            <label>Username</label>
            <input
              type="text"
              placeholder="e.g. tharunya"
              value={form.username}
              onChange={(e) => updateField("username", e.target.value)}
            />
          </div>

          {/* EMAIL */}
          <div className="form-control">
            <label>Email</label>
            <input
              type="email"
              placeholder="e.g. tharunya@example.com"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              required
            />
          </div>

          {/* PASSWORD */}
          <div className="form-control">
            <label>Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 6 characters"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: 12,
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 0
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* CONFIRM PASSWORD */}
          <div className="form-control">
            <label>Confirm Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter password"
                value={form.confirm_password}
                onChange={(e) => updateField("confirm_password", e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: 12,
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 0
                }}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* SECURITY CODE (FOR WELLNESS_COACH & ADMIN REGISTRATION) */}
          {targetRole !== "USER" && (
            <div className="form-control">
              <label>Authorization Security Code</label>
              <input
                type="password"
                placeholder={targetRole === "ADMIN" ? "Enter Admin Code (e.g. ADMIN123)" : "Enter Wellness Coach Code (e.g. MOD123)"}
                value={form.security_code}
                onChange={(e) => updateField("security_code", e.target.value)}
                required
              />
            </div>
          )}

          {/* TIMEZONE (User registration only) */}
          {targetRole === "USER" && (
            <div className="form-control">
              <label>Timezone</label>
              <select
                value={form.timezone}
                onChange={(e) => updateField("timezone", e.target.value)}
                style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: 12, padding: "0 16px", height: 48, color: "#fff" }}
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
            style={{ marginTop: 10, width: "100%", height: 48 }}
          >
            {loading ? <Loader2 size={18} className="spin" /> : "Create Account"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "#94a3b8" }}>
          Already have an account?{" "}
          <button
            onClick={onBackToLogin}
            style={{ background: "none", border: "none", color: "#a78bfa", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

export default Register;
