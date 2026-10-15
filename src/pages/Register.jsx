import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import { registerUser } from "../services/api";

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });

  const [message, setMessage] = useState("");
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

    if (formData.role === "admin") {
      setError("Administrator accounts can only be created by an existing administrator.");
      return;
    }

    setMessage("");
    setError("");
    setLoading(true);

    try {
      const data = await registerUser(formData);

      setMessage(
        data.message || "Registration successful"
      );

      setTimeout(() => {
        navigate("/login");
      }, 1000);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Create Account">

      <form onSubmit={handleSubmit}>

        {/* NAME */}
        <input
          type="text"
          name="name"
          placeholder="Name"
          value={formData.name}
          onChange={handleChange}
          required
        />

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
          minLength={8}
        />

        {/* ROLE SELECTOR */}
        <div className="role-field-group">
          <label htmlFor="role-select" className="role-label">
            Role
          </label>
          <select
            id="role-select"
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="auth-select"
          >
            <option value="user">User</option>
            <option value="wellness_coach">Wellness Coach</option>
            <option value="admin">Administrator</option>
          </select>
        </div>

        {/* ADMINISTRATOR RESTRICTION WARNING */}
        {formData.role === "admin" && (
          <div className="admin-role-warning" role="alert">
            Administrator accounts can only be created by an existing administrator.
          </div>
        )}

        {/* REGISTER */}
        <button
          type="submit"
          disabled={loading || formData.role === "admin"}
        >
          {loading ? "Creating..." : "Register"}
        </button>

        {/* SUCCESS */}
        {message && (
          <p style={{ color: "green" }}>
            {message}
          </p>
        )}

        {/* ERROR */}
        {error && (
          <p style={{ color: "red" }}>
            {error}
          </p>
        )}

      </form>
      
      <div className="login-link">
  <span>Already have an account?</span>

  <button
    type="button"
    className="login-button"
    onClick={() => navigate("/login")}
  >
    Login
  </button>
</div>
    </AuthLayout>
  );
}

export default Register;