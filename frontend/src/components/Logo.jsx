import React from "react";

function Logo({ size = "md" }) {
  const isSmall = size === "sm";
  const isLarge = size === "lg";

  const boxSize = isSmall ? 36 : isLarge ? 48 : 40;
  const iconSize = isSmall ? 20 : isLarge ? 26 : 22;
  const titleSize = isSmall ? 16 : isLarge ? 22 : 18;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, userSelect: "none" }}>
      <div
        style={{
          width: boxSize,
          height: boxSize,
          borderRadius: "50%",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          boxShadow: "none",
          flexShrink: 0
        }}
      >
        <img
          src="/cognitivewake-alarm-logo.png"
          alt="CognitiveWake alarm logo"
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", filter: "drop-shadow(0 4px 8px rgba(15, 23, 42, 0.22))" }}
        />
      </div>

      <div>
        <div
          className="logo-title"
          style={{
            fontSize: titleSize,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-0.5px",
            lineHeight: 1.1
          }}
        >
          <span className="logo-title-cognitive">Cognitive</span><span className="logo-title-wake">Wake</span>
        </div>
      </div>
    </div>
  );
}

export default Logo;
