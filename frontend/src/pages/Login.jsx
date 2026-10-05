
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
  localStorage.setItem("token", data.access_token);
  localStorage.setItem("email", email);
  localStorage.setItem("role", data.role);

  if (data.role === "Wellness Coach") {
    navigate("/coach");
  } else if (data.role === "Administrator") {
    navigate("/admin");
  } else {
    navigate("/dashboard");
  }
} else {
        setMessage(data.detail || "Invalid email or password");
      }
    } catch (error) {
      setMessage("Cannot connect to server.");
    }

    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("Account created successfully! You can login now.");

        setIsRegister(false);
        setName("");
        setConfirmPassword("");
      } else {
        setMessage(data.detail || "Registration failed.");
      }
    } catch (error) {
      setMessage("Cannot connect to server.");
    }

    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-logo">
          🧠 COGNIA
        </div>

        {!isRegister ? (
          <>
            <h1>Welcome Back 👋</h1>

            <p className="auth-subtitle">
              Continue your journey toward smarter mornings.
            </p>

            <form onSubmit={handleLogin}>

              <label>Email Address</label>

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label>Password</label>

              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="submit"
                className="auth-button"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Login"}
              </button>

            </form>

            {message && (
              <p style={{ color: "red", marginTop: "15px" }}>
                {message}
              </p>
            )}

            <p className="switch-text">
              Don't have an account?{" "}
              <span onClick={() => {
                setMessage("");
                setIsRegister(true);
              }}>
                Create Account
              </span>
            </p>
          </>
        ) : (
          <>
            <h1>Create Your Account</h1>

            <p className="auth-subtitle">
              Start building smarter wake-up habits.
            </p>

            <form onSubmit={handleRegister}>

              <label>Full Name</label>

              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <label>Email Address</label>

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label>Password</label>

              <input
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <label>Confirm Password</label>

              <input
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <button
                type="submit"
                className="auth-button"
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>

            </form>

            {message && (
              <p style={{ marginTop: "15px" }}>
                {message}
              </p>
            )}

            <p className="switch-text">
              Already have an account?{" "}
              <span onClick={() => {
                setMessage("");
                setIsRegister(false);
              }}>
                Login
              </span>
            </p>
          </>
        )}

        <button
          className="back-button"
          onClick={() => navigate("/")}
        >
          ← Back to Home
        </button>

      </div>
    </div>
  );
}

export default Login;

