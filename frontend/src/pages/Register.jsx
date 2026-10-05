import { useNavigate } from "react-router-dom";

function Register() {
  const navigate = useNavigate();

  return (
    <div className="auth-page">

      <div className="auth-card">

        <div className="auth-logo">
          🧠 COGNIA
        </div>

        <h1>Create Your Account</h1>

        <p className="auth-subtitle">
          Start building smarter wake-up habits.
        </p>

        <form>

          <label>Full Name</label>

          <input
            type="text"
            placeholder="Enter your name"
          />

          <label>Email Address</label>

          <input
            type="email"
            placeholder="Enter your email"
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Create a password"
          />

          <label>Confirm Password</label>

          <input
            type="password"
            placeholder="Confirm your password"
          />

          <button
            type="submit"
            className="auth-button"
          >
            Create Account
          </button>

        </form>

        <p className="switch-text">
          Already have an account?{" "}
          <span onClick={() => navigate("/login")}>
            Login
          </span>
        </p>

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

export default Register;

