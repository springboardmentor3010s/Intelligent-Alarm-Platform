import React from "react";
import { User, Shield, Crown, ArrowLeft } from "lucide-react";
import Logo from "../components/Logo";

function RoleSelection({ onSelectRole, onBackToLogin }) {
  return (
    <div
      className="role-selection-page"
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 50% 30%, rgba(139, 92, 246, 0.15) 0%, transparent 60%), linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Inter, sans-serif"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "rgba(30, 41, 59, 0.85)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 24,
          padding: "36px 32px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
          textAlign: "center"
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <Logo size="md" showSubtitle={false} />
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px", color: "#ffffff" }}>
          Create your CognitiveWake account
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 28px" }}>
          Select an account role to continue registration
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
          {/* USER CARD */}
          <button
            onClick={() => onSelectRole("user")}
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              borderRadius: 16,
              padding: "18px 24px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              cursor: "pointer",
              transition: "all 0.2s ease",
              color: "#ffffff",
              textAlign: "left"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#8b5cf6";
              e.currentTarget.style.background = "rgba(139, 92, 246, 0.15)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
              e.currentTarget.style.background = "rgba(15, 23, 42, 0.6)";
              e.currentTarget.style.transform = "none";
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "rgba(139, 92, 246, 0.2)",
                border: "1px solid rgba(139, 92, 246, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#c4b5fd"
              }}
            >
              <User size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>USER</div>
            </div>
          </button>

          {/* WELLNESS COACH CARD */}
          <button
            onClick={() => onSelectRole("wellness_coach")}
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              borderRadius: 16,
              padding: "18px 24px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              cursor: "pointer",
              transition: "all 0.2s ease",
              color: "#ffffff",
              textAlign: "left"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#3b82f6";
              e.currentTarget.style.background = "rgba(59, 130, 246, 0.15)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.3)";
              e.currentTarget.style.background = "rgba(15, 23, 42, 0.6)";
              e.currentTarget.style.transform = "none";
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "rgba(59, 130, 246, 0.2)",
                border: "1px solid rgba(59, 130, 246, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#93c5fd"
              }}
            >
              <Shield size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>WELLNESS COACH</div>
            </div>
          </button>

          {/* ADMIN CARD */}
          <button
            onClick={() => onSelectRole("admin")}
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 16,
              padding: "18px 24px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              cursor: "pointer",
              transition: "all 0.2s ease",
              color: "#ffffff",
              textAlign: "left"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#ef4444";
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
              e.currentTarget.style.background = "rgba(15, 23, 42, 0.6)";
              e.currentTarget.style.transform = "none";
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fca5a5"
              }}
            >
              <Crown size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>ADMIN</div>
            </div>
          </button>
        </div>

        <div style={{ fontSize: 14, color: "#94a3b8" }}>
          Already have an account?{" "}
          <button
            onClick={onBackToLogin}
            style={{
              background: "none",
              border: "none",
              color: "#a78bfa",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14
            }}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoleSelection;
