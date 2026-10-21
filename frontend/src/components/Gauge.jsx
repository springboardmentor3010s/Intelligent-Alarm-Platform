import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";
import { COLORS } from "./chartTokens";

export default function Gauge({
  value,
  label,
  color = COLORS.primary,
  suffix = "%",
  height = 180,
}) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const data = [{ name: label, value: clamped, fill: color }];

  return (
    <div style={{ position: "relative", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="72%"
          outerRadius="100%"
          data={data}
          startAngle={210}
          endAngle={-30}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            background={{ fill: "rgba(255, 255, 255, 0.05)" }}
            dataKey="value"
            cornerRadius={12}
          />
        </RadialBarChart>
      </ResponsiveContainer>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <strong
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 28,
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1,
          }}
        >
          {label === "sleep" ? value : Math.round(clamped)}
          <span style={{ fontSize: 14, color: "#94a3b8", fontWeight: 500, marginLeft: 2 }}>
            {suffix}
          </span>
        </strong>
      </div>
    </div>
  );
}
