import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import { loginUser } from "../services/api";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const data = await loginUser(formData);

      // Store JWT
      localStorage.setItem(
        "access_token",
        data.access_token
      );

      // Store user information
      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      // Navigate based on role
      if (data.user.role === "admin") {
  navigate("/admin");
} else {
  navigate("/dashboard");
}
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Welcome Back">
      <form onSubmit={handleSubmit}>

        {/* EMAIL */}
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
        />

        {/* PASSWORD */}
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
        />
        {/* LOGIN */}
        <button
          type="submit"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {/* DEMO MODE SEPARATOR */}
        <div className="demo-login-separator">
          <span>or explore instant preview</span>
        </div>

        {/* ENTER DEMO MODE BUTTON */}
        <button
          type="button"
          className="demo-enter-btn"
          onClick={() => {
            sessionStorage.setItem("demo_mode", "true");
            navigate("/dashboard");
          }}
        >
          🎯 Enter Demo Mode
        </button>

        {/* ERROR */}
        {error && (
          <p style={{ color: "red" }}>
            {error}
          </p>
        )}

        {/* REGISTER */}
        <div className="register-link">
          <span>Don't have an account?</span>

          <button
            type="button"
            className="register-button"
            onClick={() => navigate("/register")}
          >
            Register
          </button>
        </div>

      </form>
    </AuthLayout>
  );
}

export default Login;