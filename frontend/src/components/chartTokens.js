export const COLORS = {
  primary: "#6366f1",
  indigo: "#4f46e5",
  cyan: "#06b6d4",
  emerald: "#10b981",
  green: "#10b981",
  amber: "#f59e0b",
  orange: "#f59e0b",
  rose: "#f43f5e",
  pink: "#f43f5e",
  red: "#ef4444",
  violet: "#8b5cf6",
  purple: "#8b5cf6",
  slate: "#64748b",
};

export const pieColors = [
  COLORS.primary,
  COLORS.cyan,
  COLORS.emerald,
  COLORS.amber,
  COLORS.rose,
  COLORS.violet,
];

export const tooltipStyle = {
  background: "#0f172a",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "10px",
  color: "#f8fafc",
  fontSize: "12px",
  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
  padding: "8px 12px",
};

export const gridStroke = "rgba(255, 255, 255, 0.06)";
export const axisTick = { fontSize: 12, fill: "#94a3b8" };

export const statGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 16,
  marginBottom: 24,
};

export const twoColGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 20,
};
