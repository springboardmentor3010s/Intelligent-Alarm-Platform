import React from "react";
import { ShieldAlert, ArrowLeft } from "lucide-react";

function AccessDenied({ userRole, requiredRole, onReturn }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f172a",
      color: "#ffffff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      textAlign: "center"
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 24,
        background: "rgba(239, 68, 68, 0.15)",
        border: "1px solid rgba(239, 68, 68, 0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fca5a5",
        marginBottom: 20
      }}>
        <ShieldAlert size={42} />
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px" }}>403 - Access Denied</h1>
      <p style={{ color: "#94a3b8", maxWidth: 480, fontSize: 16, lineHeight: 1.6, margin: "0 0 24px" }}>
        Your account role <strong style={{ color: "#fca5a5" }}>{userRole}</strong> does not have permission to access the <strong style={{ color: "#a78bfa" }}>{requiredRole}</strong> Control Panel.
      </p>

      <button
        onClick={onReturn}
        className="primary-button"
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        <ArrowLeft size={18} /> Return to Your Authorized Dashboard
      </button>
    </div>
  );
}

export default AccessDenied;
