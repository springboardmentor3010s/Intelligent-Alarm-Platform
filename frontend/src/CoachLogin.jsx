
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function CoachLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8001/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }

      if (data.role !== "Wellness Coach") {
        setError("Access denied. Wellness Coach account required.");
        return;
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("email", data.email);

      navigate("/coach");
    } catch (err) {
      setError(err.message || "Unable to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <form onSubmit={handleLogin} style={styles.card}>
        <h1 style={styles.heading}>COGNIA</h1>

        <h2 style={styles.subheading}>Wellness Coach Login</h2>

        <p style={styles.description}>
          Sign in to access your coach dashboard.
        </p>

        <label style={styles.label}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter coach email"
          style={styles.input}
          required
        />

        <label style={styles.label}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          style={styles.input}
          required
        />

        {error && <p style={styles.error}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={styles.button}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eef2ff",
    fontFamily: "Arial, sans-serif",
    padding: "20px",
    boxSizing: "border-box",
  },

  card: {
    width: "100%",
    maxWidth: "400px",
    padding: "32px",
    backgroundColor: "#ffffff",
    color: "#222222",
    borderRadius: "16px",
    boxShadow: "0 8px 30px rgba(0, 0, 0, 0.12)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    boxSizing: "border-box",
  },

  heading: {
    color: "#3730a3",
    textAlign: "center",
    fontSize: "30px",
    margin: "0",
  },

  subheading: {
    color: "#111827",
    textAlign: "center",
    fontSize: "22px",
    margin: "8px 0",
  },

  description: {
    color: "#4b5563",
    textAlign: "center",
    fontSize: "14px",
    marginBottom: "16px",
  },

  label: {
    color: "#222222",
    fontSize: "14px",
    fontWeight: "bold",
  },

  input: {
    width: "100%",
    padding: "12px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: "15px",
    boxSizing: "border-box",
    outline: "none",
  },

  button: {
    width: "100%",
    padding: "13px",
    marginTop: "10px",
    backgroundColor: "#4f46e5",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer",
  },

  error: {
    color: "#dc2626",
    backgroundColor: "#fef2f2",
    padding: "10px",
    borderRadius: "6px",
    fontSize: "14px",
  },
};
