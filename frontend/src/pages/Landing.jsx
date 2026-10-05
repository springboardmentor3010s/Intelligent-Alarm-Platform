import { useNavigate } from "react-router-dom";

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">

      {/* Navigation */}
      <nav className="navbar">

        <div className="logo">
          🧠 <span>COGNIA</span>
        </div>

        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>

          <button
            className="login-btn"
            onClick={() => navigate("/login")}
          >
            Login
          </button>

          <button
            className="signup-btn"
            onClick={() => navigate("/register")}
          >
            Get Started
          </button>
        </div>

      </nav>


      {/* Hero Section */}
      <section className="hero">

        <div className="hero-content">

          <div className="badge">
            ✨ AI-Powered Wake-Up Experience
          </div>

          <h1>
            Wake Up Your Mind,
            <span> Not Just Your Body.</span>
          </h1>

          <p>
            Turn your morning alarm into an intelligent cognitive
            experience with personalized puzzles, challenges,
            and wake-up verification.
          </p>

          <div className="hero-buttons">

            <button
              className="primary-btn"
              onClick={() => navigate("/register")}
            >
              Start Your Journey →
            </button>

            <button
              className="secondary-btn"
              onClick={() => navigate("/login")}
            >
              Sign In
            </button>

          </div>

        </div>


        {/* Hero Card */}
        <div className="hero-card">

          <div className="alarm-icon">
            ⏰
          </div>

          <p className="small-text">
            NEXT ALARM
          </p>

          <h2>07:00 AM</h2>

          <p className="challenge-text">
            🧩 Cognitive Challenge Ready
          </p>

          <div className="progress">
            <div className="progress-fill"></div>
          </div>

          <p className="ready">
            ● Ready for tomorrow
          </p>

        </div>

      </section>


      {/* Features */}
      <section id="features" className="features">

        <h2>
          More Than Just an Alarm
        </h2>

        <p className="section-description">
          Build better mornings through intelligent
          cognitive interactions.
        </p>


        <div className="feature-grid">

          <div className="feature-card">
            <div className="feature-icon">⏰</div>
            <h3>Smart Alarms</h3>
            <p>
              Create personalized alarms based on your
              sleep and wake-up schedule.
            </p>
          </div>


          <div className="feature-card">
            <div className="feature-icon">🧩</div>
            <h3>Cognitive Challenges</h3>
            <p>
              Solve math, logic, memory and pattern
              challenges before dismissing your alarm.
            </p>
          </div>


          <div className="feature-card">
            <div className="feature-icon">🧠</div>
            <h3>Adaptive Difficulty</h3>
            <p>
              Challenge difficulty adapts according to
              your performance and engagement.
            </p>
          </div>


          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Smart Analytics</h3>
            <p>
              Track wake-up consistency, challenge
              performance and habit progress.
            </p>
          </div>

        </div>

      </section>


      {/* How It Works */}
      <section id="how-it-works" className="how-section">

        <h2>How It Works</h2>

        <div className="steps">

          <div className="step">
            <div className="step-number">01</div>
            <h3>Set Your Alarm</h3>
            <p>
              Choose your wake-up time and challenge
              preferences.
            </p>
          </div>


          <div className="step">
            <div className="step-number">02</div>
            <h3>Wake Your Mind</h3>
            <p>
              Solve personalized cognitive challenges
              when your alarm rings.
            </p>
          </div>


          <div className="step">
            <div className="step-number">03</div>
            <h3>Get Verified</h3>
            <p>
              Complete the challenge to confirm that
              you're fully awake.
            </p>
          </div>


          <div className="step">
            <div className="step-number">04</div>
            <h3>Build Better Habits</h3>
            <p>
              Track your progress and improve your
              wake-up consistency.
            </p>
          </div>

        </div>

      </section>


      {/* Bottom CTA */}
      <section className="cta">

        <h2>
          Ready to Transform Your Mornings?
        </h2>

        <p>
          Start building smarter wake-up habits today.
        </p>

        <button
          className="primary-btn"
          onClick={() => navigate("/register")}
        >
          Create Your Account →
        </button>

      </section>


      {/* Footer */}
      <footer>

        <div className="logo">
          🧠 COGNIA
        </div>

        <p>
          Intelligent Cognitive Alarm Platform
        </p>

        <p>
          © 2026 Cognia
        </p>

      </footer>

    </div>
  );
}

export default Landing;

