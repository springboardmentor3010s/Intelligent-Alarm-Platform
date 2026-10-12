import React, { useState, useEffect } from "react";
import { Brain, Sparkles, AlertTriangle, ArrowLeft } from "lucide-react";
import api from "../../services/api";
import Challenge from "./Challenge";

function PracticeChallenges({ token }) {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePracticeType, setActivePracticeType] = useState(null);

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        setLoading(true);
        const res = await api.get("/challenges/types", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTypes(res.data);
      } catch (err) {
        console.error("Failed to load challenge types:", err);
        setError("Failed to load practice modules. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchTypes();
  }, [token]);

  // If a practice type is selected, render the Challenge component in practice mode
  if (activePracticeType) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", gap: 16 }}>
        <button
          className="icon-button"
          onClick={() => setActivePracticeType(null)}
          style={{ width: "fit-content", padding: "8px 16px", display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}
        >
          <ArrowLeft size={16} /> Back to Practice Menu
        </button>
        <div style={{ flex: 1, borderRadius: 16, overflow: "hidden", position: "relative", minHeight: 600 }}>
          <Challenge 
            token={token} 
            isPractice={true} 
            practiceType={activePracticeType} 
            onDismiss={() => setActivePracticeType(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 900 }}>
      {/* HEADER SECTION */}
      <section className="progress-card" style={{
        background: "linear-gradient(135deg, rgba(30, 58, 138, 0.4), rgba(88, 28, 135, 0.28), rgba(15, 23, 42, 0.9))",
        border: "1px solid rgba(129, 140, 248, 0.28)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ padding: 10, background: "rgba(99, 102, 241, 0.2)", borderRadius: 12 }}>
            <Brain size={24} style={{ color: "#a5b4fc" }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#f8fafc" }}>Practice Area</h1>
            <p style={{ margin: "4px 0 0", color: "#a5b4fc", fontSize: 14 }}>
              Train your cognitive skills without the pressure of a ringing alarm.
            </p>
          </div>
        </div>
      </section>

      {/* ERROR / LOADING */}
      {error && (
        <div style={{ padding: 16, background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 12, color: "#fca5a5", display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={20} /> {error}
        </div>
      )}
      {loading && !error && (
        <div style={{ display: "flex", justifyContent: "center", padding: 40, color: "#94a3b8" }}>
          Loading practice modules...
        </div>
      )}

      {/* PUZZLE GRID */}
      {!loading && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {types.map((type) => (
            <div 
              key={type.id}
              className="progress-card"
              style={{
                cursor: "pointer",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                border: "1px solid rgba(148, 163, 184, 0.16)",
              }}
              onClick={() => setActivePracticeType(type.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 8px 30px rgba(0,0,0,0.4)";
                e.currentTarget.style.borderColor = "rgba(129, 140, 248, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.16)";
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ fontSize: 32, background: "rgba(255,255,255,0.05)", width: 56, height: 56, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {type.icon || "🧩"}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
                    {type.name}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>
                    {type.description}
                  </p>
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase" }}>
                    <Sparkles size={12} /> Start Practice
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PracticeChallenges;
