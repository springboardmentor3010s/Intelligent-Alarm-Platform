import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Shield,
  Crown,
  Eye,
  EyeOff,
  Loader2,
  AlarmClock,
  Brain,
  BarChart3
} from "lucide-react";
import Logo from "../components/Logo";
import api from "../services/api";

/* ─── Sparkle Effects ─────────────────────────────────────────── */
const SPARKLE_KEYFRAMES = `
  @keyframes sparkle{
    0%{opacity:0;transform:scale(0) rotate(0deg)}
    40%{opacity:1;transform:scale(1.2) rotate(90deg)}
    100%{opacity:0;transform:scale(0) rotate(180deg)}
  }
  @keyframes twinkle{
    0%,100%{opacity:0.2;transform:scale(0.6)}
    50%{opacity:1;transform:scale(1.1)}
  }
  @keyframes drift{
    0%{transform:translateY(0) translateX(0) rotate(0deg);opacity:1}
    100%{transform:translateY(-80px) translateX(var(--dx,20px)) rotate(360deg);opacity:0}
  }
`;

function SparkleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let W, H;
    const stars = [];
    const NUM = 90;

    const resize = () => {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < NUM; i++) {
      stars.push({
        x: Math.random() * 1920,
        y: Math.random() * 1080,
        r: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 0.3 + 0.05,
        phase: Math.random() * Math.PI * 2,
        freq: Math.random() * 0.01 + 0.005,
        color: ["#a78bfa", "#f472b6", "#38bdf8", "#ffffff", "#fcd34d"][Math.floor(Math.random() * 5)],
      });
    }

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      t += 1;
      for (const s of stars) {
        const opacity = 0.2 + 0.8 * Math.abs(Math.sin(s.phase + t * s.freq));
        const radius  = s.r * (0.7 + 0.6 * Math.abs(Math.sin(s.phase + t * s.freq * 0.7)));
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 6;
        ctx.translate(s.x % W, s.y % H);
        ctx.beginPath();
        for (let j = 0; j < 8; j++) {
          const angle = (j * Math.PI) / 4;
          const r = j % 2 === 0 ? radius * 2.2 : radius * 0.8;
          if (j === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
          else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        s.y -= s.speed;
        if (s.y < -10) { s.y = H + 10; s.x = Math.random() * W; }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 0,
      }}
    />
  );
}

function SparkItem({ id, x, y, color, dx }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.setProperty("--dx", `${dx}px`);
    }
  }, [dx]);
  return (
    <div ref={ref} style={{
      position: "fixed",
      left: x - 6, top: y - 6,
      width: 12, height: 12,
      pointerEvents: "none",
      animation: "drift 0.7s ease-out forwards",
    }}>
      <svg width="12" height="12" viewBox="0 0 12 12">
        <polygon
          points="6,0 7,5 12,6 7,7 6,12 5,7 0,6 5,5"
          fill={color}
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
      </svg>
    </div>
  );
}

function MouseSparkle() {
  const [sparks, setSparks] = useState([]);
  const nextId = useRef(0);

  const handleMouseMove = (e) => {
    if (Math.random() > 0.18) return;
    const id = nextId.current++;
    const colors = ["#a78bfa", "#f472b6", "#38bdf8", "#fcd34d", "#34d399"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const dx = (Math.random() - 0.5) * 60;
    setSparks(prev => [...prev, { id, x: e.clientX, y: e.clientY, color, dx }]);
    setTimeout(() => setSparks(prev => prev.filter(s => s.id !== id)), 700);
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
      {sparks.map(s => (
        <SparkItem key={s.id} {...s} />
      ))}
    </div>
  );
}

function Login({ onLogin, onNavigateToRegister }) {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [selectedRole, setSelectedRole] = useState("USER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    if (!emailOrUsername.trim()) {
      setError("Please enter your username or email.");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/login", {
        username_or_email: emailOrUsername.trim(),
        email: emailOrUsername.trim(),
        password: password.trim(),
        role: selectedRole,
      });

      const token = response.data.access_token;
      localStorage.setItem("token", token);
      onLogin(token);
    } catch (err) {
      console.error(err);
      if (!err.response) {
        setError("Unable to connect to server. Please ensure backend is running.");
      } else {
        const detail = err.response?.data?.detail;
        setError(typeof detail === "string" ? detail : "Invalid username or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ position: "relative", overflow: "hidden" }}>
      <style>{SPARKLE_KEYFRAMES}</style>
      <SparkleCanvas />
      <MouseSparkle />


      {/* RIGHT SIDE LOGIN CARD */}
      <div className="login-right">
        <div className="login-card">
          <h1 style={{ fontSize: 24, margin: "0 0 4px", textAlign: "center" }}>Welcome back</h1>
          <p className="login-subtitle">Sign in to continue to CognitiveWake</p>

          {error && <div className="error-box">{error}</div>}

          <form onSubmit={handleLogin} className="login-form">
            {/* USERNAME OR EMAIL */}
            <div className="form-control">
              <label>Username or Email</label>
              <input
                type="text"
                placeholder="Enter username or email"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                required
              />
            </div>

            {/* PASSWORD */}
            <div className="form-control">
              <label>Password</label>
              <div className="password-field" style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: 14,
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

            {/* REMEMBER ME & FORGOT PASSWORD */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#94a3b8", margin: "4px 0 10px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textTransform: "none", letterSpacing: "normal" }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                Remember Me
              </label>
              <a href="#forgot" onClick={(e) => { e.preventDefault(); alert("Password reset link sent to your registered email."); }} style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 600 }}>
                Forgot password?
              </a>
            </div>

            {/* SIGN IN AS ROLE SELECTOR */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 8 }}>
                SIGN IN AS
              </label>

              <div className="login-role-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[
                  { role: "USER", icon: User },
                  { role: "WELLNESS_COACH", icon: Shield },
                  { role: "ADMIN", icon: Crown },
                ].map(({ role, icon: Icon }) => {
                  const isSelected = selectedRole === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      style={{
                        background: isSelected
                          ? role === "ADMIN"
                            ? "rgba(239, 68, 68, 0.2)"
                            : role === "WELLNESS_COACH"
                            ? "rgba(59, 130, 246, 0.2)"
                            : "rgba(139, 92, 246, 0.25)"
                          : "rgba(15, 23, 42, 0.6)",
                        border: isSelected
                          ? role === "ADMIN"
                            ? "1px solid #ef4444"
                            : role === "WELLNESS_COACH"
                            ? "1px solid #3b82f6"
                            : "1px solid #8b5cf6"
                          : "1px solid rgba(255, 255, 255, 0.12)",
                        color: isSelected ? "#ffffff" : "#94a3b8",
                        borderRadius: 12,
                        padding: "10px 8px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        transition: "all 0.2s ease"
                      }}
                    >
                      <Icon size={16} color={isSelected ? "#a78bfa" : "#64748b"} />
                      <span>{role === "WELLNESS_COACH" ? "WELLNESS COACH" : role}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SIGN IN BUTTON (EXACT TEXT "Sign In") */}
            <button type="submit" className="login-button" disabled={loading} style={{ width: "100%", height: 48 }}>
              {loading ? <Loader2 size={18} className="spin" /> : "Sign In"}
            </button>
          </form>

          {/* CREATE ACCOUNT LINK */}
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#94a3b8" }}>
            Don't have an account?{" "}
            <button
              onClick={() => onNavigateToRegister(selectedRole)}
              style={{
                background: "none",
                border: "none",
                color: "#a78bfa",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14
              }}
            >
              Create account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
