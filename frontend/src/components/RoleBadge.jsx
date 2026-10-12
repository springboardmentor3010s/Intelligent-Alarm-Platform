import React from "react";
import { User, Shield, Crown } from "lucide-react";

function RoleBadge({ role = "USER", size = "normal" }) {
  const roleUpper = (role || "USER").toUpperCase();

  const roleLabel = roleUpper === "WELLNESS_COACH" ? "WELLNESS COACH" : roleUpper;
  const isSmall = size === "small";

  let bg = "rgba(139, 92, 246, 0.15)";
  let border = "1px solid rgba(139, 92, 246, 0.3)";
  let color = "#c4b5fd";
  let Icon = User;

  if (roleUpper === "WELLNESS_COACH") {
    bg = "rgba(59, 130, 246, 0.15)";
    border = "1px solid rgba(59, 130, 246, 0.3)";
    color = "#93c5fd";
    Icon = Shield;
  } else if (roleUpper === "ADMIN") {
    bg = "rgba(239, 68, 68, 0.15)";
    border = "1px solid rgba(239, 68, 68, 0.3)";
    color = "#fca5a5";
    Icon = Crown;
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: isSmall ? "2px 8px" : "4px 10px",
        borderRadius: 8,
        background: bg,
        border: border,
        color: color,
        fontSize: isSmall ? 10 : 12,
        fontWeight: 700,
        letterSpacing: "0.5px",
        textTransform: "uppercase",
        userSelect: "none"
      }}
    >
      <Icon size={isSmall ? 12 : 14} />
      {roleLabel}
    </span>
  );
}

export default RoleBadge;
