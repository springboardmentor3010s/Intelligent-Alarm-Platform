import React, { useEffect, useState, useRef } from "react";
import { RefreshCw, Flame, Target, Zap, Moon, Clock, Calendar, Brain, Award, Sparkles, AlertCircle, BarChart2, Timer, PieChart } from "lucide-react";
import api from "../../services/api";

/* ══════════════════════════════════════════════════════
   SVG Line Chart — Pure, responsive SVG trend line
   ══════════════════════════════════════════════════════ */
function LineChart({ data, dataKey, color, label, yMax = 100, sublabel }) {
  const W = 360, H = 140, PAD = { t: 16, r: 16, b: 32, l: 38 };
  const pts = data.length;

  if (pts < 2) return (
    <div style={{
      width: "100%", height: H, display: "flex", alignItems: "center", justifyContent: "center",
      color: "#475569", fontSize: 12, background: "rgba(15,23,42,0.4)", borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.05)"
    }}>
      Not enough data recorded for this timeframe
    </div>
  );

  const vals = data.map(d => d[dataKey] ?? 0);
  const vMax = Math.max(yMax, ...vals);
  const xStep = (W - PAD.l - PAD.r) / (pts - 1);
  const yScale = v => H - PAD.b - ((v / (vMax || 1)) * (H - PAD.t - PAD.b));
  const points = vals.map((v, i) => `${PAD.l + i * xStep},${yScale(v)}`).join(" ");
  const areaClose = `${PAD.l + (pts - 1) * xStep},${H - PAD.b} ${PAD.l},${H - PAD.b}`;

  return (
    <div style={{ padding: "4px 0 18px", display: "flex", flexDirection: "column", gap: 6, borderBottom: `1px solid ${color}85` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#f8fafc" }}>{label}</div>
          {sublabel && <div style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 600, marginTop: 2 }}>{sublabel}</div>}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}15`, padding: "2px 8px", borderRadius: 6, border: `1px solid ${color}30` }}>
          Latest: {vals[vals.length - 1]}
        </span>
      </div>

      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", marginTop: 4 }}>
        {[0, 25, 50, 75, 100].map(v => {
          const y = yScale((v / 100) * vMax);
          return (
            <g key={v}>
              <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="rgba(226,232,240,0.28)" strokeWidth={1.2} strokeDasharray="3 3" />
              <text x={PAD.l - 6} y={y + 3} fontSize={9} fontWeight="600" fill="#cbd5e1" textAnchor="end">{Math.round((v / 100) * vMax)}</text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const stepRatio = pts > 15 ? Math.ceil(pts / 6) : pts > 8 ? 2 : 1;
          if (i % stepRatio !== 0 && i !== pts - 1) return null;
          return (
            <text key={i} x={PAD.l + i * xStep} y={H - PAD.b + 16} fontSize={9} fontWeight="600" fill="#cbd5e1" textAnchor="middle">
              {d.day}
            </text>
          );
        })}

        <polygon points={`${points} ${areaClose}`} fill={`${color}28`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth={3.2} strokeLinejoin="round" strokeLinecap="round" />
        {vals.map((v, i) => (
          <circle key={i} cx={PAD.l + i * xStep} cy={yScale(v)} r={3.5} fill={color} stroke="#0f172a" strokeWidth={2} />
        ))}
      </svg>
    </div>
  );
}


/* ══════════════════════════════════════════════════════
   SVG Bar Chart — Daily Alarm Activity
   ══════════════════════════════════════════════════════ */
function HabitScoreGauge({ score, tier, streak }) {
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score));
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <div style={{ minHeight: 230, display: "grid", placeItems: "center", position: "relative", background: "radial-gradient(circle at 50% 45%, rgba(129,140,248,0.17), transparent 65%)" }}>
      <svg width="210" height="210" viewBox="0 0 210 210" aria-label={`Habit score: ${score} out of 100`}>
        <circle cx="105" cy="105" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="13" />
        <circle cx="105" cy="105" r={radius} fill="none" stroke="url(#habitGradient)" strokeWidth="13" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} transform="rotate(-90 105 105)" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
        <defs><linearGradient id="habitGradient" x1="0" x2="1"><stop stopColor="#818cf8" /><stop offset="1" stopColor="#f472b6" /></linearGradient></defs>
        <text x="105" y="99" fill="#ffffff" textAnchor="middle" fontSize="37" fontWeight="900">{score.toFixed(1)}</text>
        <text x="105" y="121" fill="#94a3b8" textAnchor="middle" fontSize="11" fontWeight="700">HABIT SCORE</text>
      </svg>
      <div style={{ marginTop: -38, textAlign: "center" }}>
        <div style={{ color: "#f9a8d4", fontWeight: 800, fontSize: 13 }}>{tier}</div>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{streak} day wake-up streak</div>
      </div>
    </div>
  );
}

function AlarmOutcomeChart({ completed, total, snoozes }) {
  const missed = Math.max(0, total - completed);
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const snoozeRate = total > 0 ? Math.round((snoozes / total) * 100) : 0;
  const rows = [
    { label: "Completed alarms", value: completed, max: total, color: "#34d399" },
    { label: "Missed alarms", value: missed, max: total, color: "#f472b6" },
    { label: "Snoozes", value: snoozes, max: Math.max(total, snoozes), color: "#f59e0b" },
  ];

  return (
    <div style={{ padding: "10px 0 6px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <div><div style={{ color: "#f8fafc", fontSize: 15, fontWeight: 800 }}>Alarm outcomes</div><div style={{ color: "#64748b", fontSize: 11, marginTop: 3 }}>Your recorded alarm sessions</div></div>
        <strong style={{ color: "#6ee7b7", fontSize: 28 }}>{completionRate}%</strong>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {rows.map(row => (
          <div key={row.label}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1", fontSize: 12, fontWeight: 700, marginBottom: 7 }}><span>{row.label}</span><span style={{ color: row.color }}>{row.value}</span></div>
            <div style={{ height: 9, background: "rgba(255,255,255,0.07)", borderRadius: 6, overflow: "hidden" }}><div style={{ height: "100%", width: `${row.max > 0 ? Math.min(100, (row.value / row.max) * 100) : 0}%`, background: row.color, borderRadius: 6, transition: "width 0.8s ease" }} /></div>
          </div>
        ))}
      </div>
      <div style={{ color: "#64748b", fontSize: 11, marginTop: 17 }}>Snooze rate: {snoozeRate}% of alarm sessions</div>
    </div>
  );
}

function DailyAlarmsBarChart({ data }) {
  const W = 540, H = 200, PAD = { t: 28, r: 16, b: 48, l: 40 };
  const pts = data.length;
  if (pts < 1) return (
    <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 13, background: "rgba(15,23,42,0.4)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.05)" }}>
      No alarm activity data available yet.
    </div>
  );
  const vals = data.map(d => d.challenge_activity ?? 0);
  const vMax = Math.max(1, ...vals);
  const barWidth = Math.max(8, Math.floor((W - PAD.l - PAD.r) / (pts * 1.6)));
  const gap = (W - PAD.l - PAD.r - pts * barWidth) / (pts + 1);
  const yScale = v => H - PAD.b - ((v / vMax) * (H - PAD.t - PAD.b));
  return (
    <div style={{ padding: "4px 0 22px", borderBottom: "1px solid rgba(245,158,11,0.25)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#f8fafc", display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart2 size={18} color="#f59e0b" /> Daily Alarm Activity
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Puzzles attempted per day from active alarms</div>
        </div>
        <div style={{ fontSize: 11, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "4px 12px", borderRadius: 8, border: "1px solid rgba(245,158,11,0.2)", fontWeight: 700 }}>
          Total: {vals.reduce((a, b) => a + b, 0)} activities
        </div>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {[0, 25, 50, 75, 100].map(pct => {
          const v = Math.round((pct / 100) * vMax);
          const y = yScale(v);
          return (
            <g key={pct}>
              <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} strokeDasharray="3 3" />
              <text x={PAD.l - 6} y={y + 3} fontSize={8.5} fill="#475569" textAnchor="end">{v}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const v = vals[i];
          const barH = (v / vMax) * (H - PAD.t - PAD.b);
          const x = PAD.l + gap + i * (barWidth + gap);
          const y = H - PAD.b - barH;
          const hue = `hsl(${200 + i * 14}, 80%, 60%)`;
          return (
            <g key={i}>
              <rect x={x} y={PAD.t} width={barWidth} height={H - PAD.t - PAD.b} fill="rgba(255,255,255,0.025)" rx={4} />
              <rect x={x} y={y} width={barWidth} height={Math.max(3, barH)} fill={hue} rx={4} />
              {v > 0 && <text x={x + barWidth / 2} y={Math.max(PAD.t + 12, y - 5)} fontSize={9} fontWeight="bold" fill="#f8fafc" textAnchor="middle">{v}</text>}
              <text x={x + barWidth / 2} y={H - PAD.b + 16} fontSize={8.5} fill="#64748b" textAnchor="middle">{d.day}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SVG Bar Chart — Comparative Puzzle Type Accuracy
   ══════════════════════════════════════════════════════ */
function AccuracyBarChart({ puzzleBreakdown }) {
  const puzzleTypes = [
    { id: "MATH",          name: "Math",          icon: "🧮", color: "#6366f1" },
    { id: "WORD_SCRAMBLE", name: "Word Scramble",  icon: "🔤", color: "#f59e0b" },
    { id: "SEQUENCE",      name: "Sequence",       icon: "🔢", color: "#10b981" },
    { id: "MEMORY",        name: "Memory",         icon: "🧠", color: "#ec4899" },
    { id: "TRIVIA",        name: "Trivia",         icon: "💡", color: "#3b82f6" },
    { id: "COLOR_MATCH",   name: "Color Match",    icon: "🎨", color: "#a855f7" },
  ];

  const W = 520, H = 200, PAD = { t: 28, r: 16, b: 46, l: 38 };
  const barWidth = 38;
  const numBars = puzzleTypes.length;
  const gap = (W - PAD.l - PAD.r - (numBars * barWidth)) / (numBars + 1);

  return (
    <div style={{ padding: "4px 0 22px", borderBottom: "1px solid rgba(52,211,153,0.25)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#f8fafc", display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart2 size={18} color="#34d399" /> Accuracy by Puzzle Type
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Comparing accuracy percentages across challenge categories</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#34d399", background: "rgba(52,211,153,0.1)", padding: "4px 12px", borderRadius: 8, border: "1px solid rgba(52,211,153,0.2)" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399" }} />
          80% Target Threshold Line
        </div>
      </div>

      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {[0, 25, 50, 75, 80, 100].map(v => {
          const y = H - PAD.b - ((v / 100) * (H - PAD.t - PAD.b));
          const isTarget = v === 80;
          return (
            <g key={v}>
              <line
                x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
                stroke={isTarget ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.05)"}
                strokeWidth={isTarget ? 1.5 : 1}
                strokeDasharray={isTarget ? "4 4" : "none"}
              />
              <text x={PAD.l - 6} y={y + 3} fontSize={8.5} fill={isTarget ? "#34d399" : "#475569"} fontWeight={isTarget ? "bold" : "normal"} textAnchor="end">{v}%</text>
            </g>
          );
        })}

        {puzzleTypes.map((p, i) => {
          const stat = (puzzleBreakdown ?? {})[p.id] || { accuracy: 0, attempts: 0 };
          const accPct = Math.min(100, Math.max(0, stat.accuracy));
          const barH = (accPct / 100) * (H - PAD.t - PAD.b);
          const x = PAD.l + gap + i * (barWidth + gap);
          const y = H - PAD.b - barH;

          return (
            <g key={p.id}>
              <rect x={x} y={PAD.t} width={barWidth} height={H - PAD.t - PAD.b} fill="rgba(255,255,255,0.03)" rx={6} />
              <rect x={x} y={y} width={barWidth} height={Math.max(4, barH)} fill={p.color} rx={6} />
              <text x={x + barWidth / 2} y={Math.min(y - 6, H - PAD.b - 10)} fontSize={9.5} fontWeight="bold" fill="#f8fafc" textAnchor="middle">
                {stat.accuracy.toFixed(0)}%
              </text>
              <text x={x + barWidth / 2} y={H - PAD.b + 16} fontSize={11} textAnchor="middle">{p.icon}</text>
              <text x={x + barWidth / 2} y={H - PAD.b + 30} fontSize={8.5} fill="#94a3b8" fontWeight="600" textAnchor="middle">
                {p.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SVG Donut / Pie Chart — Interactive Topic Breakdown
   ══════════════════════════════════════════════════════ */
function polarToCartesian(cx, cy, r, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
}

function describeDonutArc(cx, cy, innerR, outerR, startAngle, endAngle) {
  const diff = Math.min(359.99, Math.max(0.1, endAngle - startAngle));
  const actualEnd = startAngle + diff;
  const startOuter = polarToCartesian(cx, cy, outerR, actualEnd);
  const endOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const startInner = polarToCartesian(cx, cy, innerR, startAngle);
  const endInner = polarToCartesian(cx, cy, innerR, actualEnd);
  const largeArcFlag = diff <= 180 ? "0" : "1";

  return [
    "M", startOuter.x, startOuter.y,
    "A", outerR, outerR, 0, largeArcFlag, 0, endOuter.x, endOuter.y,
    "L", startInner.x, startInner.y,
    "A", innerR, innerR, 0, largeArcFlag, 1, endInner.x, endInner.y,
    "Z"
  ].join(" ");
}

function TopicPieChart({ puzzleBreakdown, habitFactors, timeOfDayStats }) {
  const [topicMode, setTopicMode] = useState("puzzles"); // "puzzles" | "habit" | "tod"
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // 1. Puzzle Topics Data
  const puzzleTopics = [
    { id: "MATH",          name: "Math",          icon: "🧮", color: "#6366f1" },
    { id: "WORD_SCRAMBLE", name: "Word Scramble",  icon: "🔤", color: "#f59e0b" },
    { id: "SEQUENCE",      name: "Sequence",       icon: "🔢", color: "#10b981" },
    { id: "MEMORY",        name: "Memory",         icon: "🧠", color: "#ec4899" },
    { id: "TRIVIA",        name: "Trivia",         icon: "💡", color: "#3b82f6" },
    { id: "COLOR_MATCH",   name: "Color Match",    icon: "🎨", color: "#a855f7" },
  ];

  const puzzleData = puzzleTopics.map(p => {
    const stat = (puzzleBreakdown ?? {})[p.id] || { attempts: 0, correct: 0, accuracy: 0 };
    return {
      id: p.id,
      name: p.name,
      icon: p.icon,
      color: p.color,
      value: stat.attempts,
      secondary: `${stat.correct} solved · ${stat.accuracy.toFixed(0)}% acc`,
      label: p.name
    };
  });

  // 2. Habit Score Pillars Data
  const habitData = (habitFactors || []).map(h => ({
    id: h.label,
    name: h.label,
    icon: h.label.includes("Wake") ? "⏰" : h.label.includes("Completion") ? "🎯" : h.label.includes("Snooze") ? "⚡" : "🌙",
    color: h.color,
    value: Math.round(h.pct * (h.value / 100)),
    secondary: `${h.value.toFixed(1)}% score · ${h.pct}% weight`,
    label: h.label
  }));

  // 3. Time of Day Data
  const todIcons = { "Morning (5-10am)": "🌅", "Day (10am-5pm)": "☀️", "Evening (5-10pm)": "🌆", "Night (10pm-5am)": "🌙" };
  const todColors = { "Morning (5-10am)": "#f59e0b", "Day (10am-5pm)": "#38bdf8", "Evening (5-10pm)": "#818cf8", "Night (10pm-5am)": "#a855f7" };
  const todData = Object.entries(timeOfDayStats || {}).map(([key, val]) => ({
    id: key,
    name: key.split(" ")[0],
    icon: todIcons[key] || "⏰",
    color: todColors[key] || "#94a3b8",
    value: val.attempts || 0,
    secondary: `${val.correct || 0} solved · ${val.accuracy || 0}% acc`,
    label: key
  }));

  const activeDataset = topicMode === "puzzles" ? puzzleData : topicMode === "habit" ? habitData : todData;
  const totalValue = activeDataset.reduce((sum, item) => sum + (item.value || 0), 0);

  // Compute angles for slices
  let currentAngle = 0;
  const slices = activeDataset.map((item, idx) => {
    const val = item.value || 0;
    const sliceAngle = totalValue > 0 ? (val / totalValue) * 360 : (360 / activeDataset.length);
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;
    const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : (100 / activeDataset.length).toFixed(1);
    return {
      ...item,
      startAngle,
      endAngle,
      pct,
      idx
    };
  });

  const activeItem = hoveredIndex !== null ? slices[hoveredIndex] : null;
  const CX = 130, CY = 130, R_OUTER = 98, R_INNER = 58;

  return (
    <div style={{
      borderBottom: "1px solid rgba(236,72,153,0.25)",
      padding: "4px 0 22px",
      display: "flex",
      flexDirection: "column",
      gap: 18
    }}>
      {/* Top Header & Mode Switcher */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#f8fafc", display: "flex", alignItems: "center", gap: 8 }}>
            <PieChart size={18} color="#ec4899" /> Topic Distribution Pie Chart
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            Interactive proportion chart for challenge topics &amp; habit pillars
          </div>
        </div>

        {/* Tab pills */}
        <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 3, border: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={() => { setTopicMode("puzzles"); setHoveredIndex(null); }}
            style={{
              background: topicMode === "puzzles" ? "rgba(99,102,241,0.25)" : "transparent",
              color: topicMode === "puzzles" ? "#818cf8" : "#94a3b8",
              border: topicMode === "puzzles" ? "1px solid rgba(99,102,241,0.5)" : "1px solid transparent",
              borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.2s"
            }}
          >
            🧩 Topics
          </button>
          <button
            onClick={() => { setTopicMode("habit"); setHoveredIndex(null); }}
            style={{
              background: topicMode === "habit" ? "rgba(52,211,153,0.25)" : "transparent",
              color: topicMode === "habit" ? "#34d399" : "#94a3b8",
              border: topicMode === "habit" ? "1px solid rgba(52,211,153,0.5)" : "1px solid transparent",
              borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.2s"
            }}
          >
            🎯 Habit Score
          </button>
          <button
            onClick={() => { setTopicMode("tod"); setHoveredIndex(null); }}
            style={{
              background: topicMode === "tod" ? "rgba(244,114,182,0.25)" : "transparent",
              color: topicMode === "tod" ? "#f472b6" : "#94a3b8",
              border: topicMode === "tod" ? "1px solid rgba(244,114,182,0.5)" : "1px solid transparent",
              borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.2s"
            }}
          >
            ⏰ Time
          </button>
        </div>
      </div>

      {/* Main Chart Body: SVG Pie + Interactive Legend */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
        alignItems: "center",
        gap: 20
      }}>
        {/* SVG Donut / Pie */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
          <svg width="240" height="240" viewBox="0 0 260 260" style={{ overflow: "visible" }}>
            {totalValue === 0 ? (
              <g>
                <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={R_OUTER - R_INNER} />
                <text x={CX} y={CY - 6} textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="700">No attempts yet</text>
                <text x={CX} y={CY + 12} textAnchor="middle" fill="#64748b" fontSize="9.5">Complete challenges</text>
              </g>
            ) : (
              slices.map((s, idx) => {
                const isHovered = hoveredIndex === idx;
                const rOut = isHovered ? R_OUTER + 6 : R_OUTER;
                const rIn = isHovered ? R_INNER - 2 : R_INNER;
                if (s.value === 0 && totalValue > 0) return null;
                const d = describeDonutArc(CX, CY, rIn, rOut, s.startAngle, s.endAngle);

                return (
                  <path
                    key={s.id || idx}
                    d={d}
                    fill={s.color}
                    opacity={hoveredIndex === null ? 0.9 : isHovered ? 1 : 0.4}
                    stroke="#0f172a"
                    strokeWidth={2}
                    style={{
                      cursor: "pointer",
                      transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                      filter: isHovered ? `drop-shadow(0 0 10px ${s.color}88)` : "none"
                    }}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                );
              })
            )}

            {/* Center Hole Summary Text */}
            {totalValue > 0 && (
              <g style={{ pointerEvents: "none" }}>
                <circle cx={CX} cy={CY} r={R_INNER - 4} fill="#0b1120" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                {activeItem ? (
                  <>
                    <text x={CX} y={CY - 16} textAnchor="middle" fontSize="16">{activeItem.icon}</text>
                    <text x={CX} y={CY + 2} textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="900">
                      {activeItem.name}
                    </text>
                    <text x={CX} y={CY + 18} textAnchor="middle" fill={activeItem.color} fontSize="11" fontWeight="800">
                      {activeItem.pct}%
                    </text>
                  </>
                ) : (
                  <>
                    <text x={CX} y={CY - 8} textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="700" textTransform="uppercase" letterSpacing={1}>
                      {topicMode === "puzzles" ? "Total Attempts" : topicMode === "habit" ? "Habit Score" : "Activity"}
                    </text>
                    <text x={CX} y={CY + 14} textAnchor="middle" fill="#fff" fontSize="19" fontWeight="900">
                      {totalValue}
                    </text>
                  </>
                )}
              </g>
            )}
          </svg>
        </div>

        {/* Legend / Category breakdown list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%", maxHeight: 230, overflowY: "auto", paddingRight: 4 }}>
          {slices.map((s, idx) => {
            const isHovered = hoveredIndex === idx;
            const hasData = s.value > 0;

            return (
              <div
                key={s.id || idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: isHovered ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                  border: isHovered ? `1px solid ${s.color}60` : "1px solid rgba(255,255,255,0.05)",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: s.color, boxShadow: isHovered ? `0 0 8px ${s.color}` : "none",
                    flexShrink: 0
                  }} />
                  <span style={{ fontSize: 13 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isHovered ? "#fff" : "#cbd5e1" }}>
                      {s.label}
                    </div>
                    {s.secondary && (
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>
                        {s.secondary}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 800,
                    color: hasData ? s.color : "#475569",
                    background: `${s.color}15`,
                    padding: "2px 7px",
                    borderRadius: 6,
                    border: `1px solid ${s.color}30`
                  }}>
                    {hasData ? `${s.pct}%` : "0%"}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", minWidth: 20, textAlign: "right" }}>
                    {s.value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Mini Stat Card Component
   ══════════════════════════════════════════════════════ */
function MiniCard({ icon, accent, title, value, sub }) {
  return (
    <div style={{
      borderBottom: `1px solid ${accent}45`,
      padding: "8px 0 14px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      gap: 8,
      minWidth: 160,
      flex: 1,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, boxShadow: `0 0 8px ${accent}` }} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{sub}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN PERFORMANCE DASHBOARD
   ══════════════════════════════════════════════════════ */
function Progress({ token }) {
  const [loading, setLoading]       = useState(true);
  const [data, setData]             = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [recHistory, setRecHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Timeframe switch: "weekly" (7 days) | "monthly" (30 days)
  const [timeFrame, setTimeFrame]   = useState("weekly");

  const habitRef          = useRef(null);
  const behavioralRef     = useRef(null);
  const topicsRef         = useRef(null);
  const recommendationRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const [ana, ts, rh] = await Promise.all([
        api.get("/ml-sd/analytics",                          { headers }),
        api.get("/ml-sd/behavior-timeseries?days=30",         { headers }),
        api.get("/ml-sd/recommendations",                    { headers }),
      ]);
      setData(ana.data);
      setTimeseries(ts.data || []);
      setRecHistory(rh.data || []);
    } catch (err) {
      console.error("Failed to load performance analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const scrollToSection = (ref) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Filter timeseries according to weekly/monthly selector
  const filteredTimeseries = timeFrame === "weekly" ? timeseries.slice(-7) : timeseries.slice(-30);

  // Aggregated timeframe metrics
  const totalTriggersInView = filteredTimeseries.reduce((acc, d) => acc + (d.challenge_activity > 0 ? 1 : 0), 0) || (data?.total_alarms_created ?? 0);
  const totalSnoozesInView  = filteredTimeseries.reduce((acc, d) => acc + (d.snooze_count ?? 0), 0);

  const avgAccuracyInView = filteredTimeseries.length > 0
    ? (filteredTimeseries.reduce((acc, d) => acc + (d.accuracy ?? 0), 0) / filteredTimeseries.length)
    : (data?.accuracy_rate ?? 0);

  // Response time speed metric
  const meanResponseTime = data?.mean_response_time ?? data?.predicted_response_time ?? 6.8;

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 450, gap: 16 }}>
      <RefreshCw size={36} className="spin" style={{ color: "#818cf8" }} />
      <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 700 }}>Loading Performance &amp; Behavioral Data…</p>
    </div>
  );

  // Habit metrics
  const habitScore    = data?.habit_score ?? 75.0;
  const habitTier     = data?.habit_tier  ?? "Building Habit 📈";
  const hb            = data?.habit_breakdown ?? {};
  const wc            = hb.wakeup_consistency ?? 85;
  const cs            = hb.completion_success ?? 80;
  const sr            = hb.snooze_reduction   ?? 90;
  const sa            = hb.sleep_adherence    ?? 85;
  const streak        = data?.streak ?? 0;
  const totalAlarms   = data?.total_alarms_created ?? 0;
  const puzzlesSolved = data?.puzzles_solved ?? 0;
  const totalAttempts = data?.total_attempts ?? 0;

  const habitFactors = [
    { label: "Wake-Up Consistency", pct: 35, value: wc,  color: "#818cf8", icon: <Clock size={14} /> },
    { label: "Completion Success",  pct: 25, value: cs,  color: "#34d399", icon: <Target size={14} /> },
    { label: "Snooze Reduction",    pct: 20, value: sr,  color: "#f472b6", icon: <Zap size={14} /> },
    { label: "Schedule Adherence",  pct: 20, value: sa,  color: "#38bdf8", icon: <Moon size={14} /> },
  ];

  const fmtDate = iso => {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  const catIcon = cat => {
    if (cat === "Latest Challenge Performance") return "🏆";
    if (cat === "Weakest Challenge Type")       return "⚠️";
    if (cat === "Habit Guidance")               return "🔥";
    if (cat === "Productivity")                 return "⚡";
    return "💡";
  };

  // Only show alarm outcomes that are meaningful for this project.
  const configuredAlarms = data?.total_alarms_created ?? 0;
  const completedAlarms = data?.completed_alarm_sessions ?? 0;
  const totalAlarmSessions = data?.alarm_sessions ?? 0;
  const completionRate = data?.alarm_completion_rate ?? 0;
  const totalSnoozes = data?.snooze_stats?.total_snoozes ?? 0;
  const summaryStats = [
    { label: "Habit Score", value: habitScore.toFixed(1), detail: habitTier, color: "#a5b4fc" },
    { label: "Wake-up Streak", value: `${streak} days`, detail: "Consecutive completed mornings", color: "#f9a8d4" },
    { label: "Puzzles Solved", value: data?.puzzles_solved ?? 0, detail: `from ${data?.total_attempts ?? 0} attempts`, color: "#6ee7b7" },
    { label: "Challenge Accuracy", value: `${(data?.accuracy_rate ?? 0).toFixed(1)}%`, detail: "Correct puzzle responses", color: "#fcd34d" },
  ];
  const puzzleTopics = [
    { id: "MATH", name: "Math", color: "#818cf8" },
    { id: "WORD_SCRAMBLE", name: "Word Scramble", color: "#f59e0b" },
    { id: "SEQUENCE", name: "Sequence", color: "#34d399" },
    { id: "MEMORY", name: "Memory", color: "#f472b6" },
    { id: "TRIVIA", name: "Trivia", color: "#38bdf8" },
    { id: "COLOR_MATCH", name: "Color Match", color: "#c084fc" },
  ].map(topic => ({ ...topic, ...(data?.puzzle_breakdown?.[topic.id] ?? { attempts: 0, correct: 0, accuracy: 0 }) }));
  const accuracy = data?.accuracy_rate ?? 0;
  const weakTopic = puzzleTopics.filter(topic => topic.attempts > 0).sort((a, b) => a.accuracy - b.accuracy)[0];
  const snoozeRate = totalAlarmSessions > 0 ? Math.round((totalSnoozes / totalAlarmSessions) * 100) : 0;
  const recommendationCandidates = [
    totalSnoozes > 3 && { priority: "High impact", accent: "#fb7185", title: "Break the snooze loop", insight: `${totalSnoozes} snoozes were recorded across your alarm sessions.`, action: "Place your phone out of reach tonight and commit to standing up before the first challenge.", measure: "Aim for one fewer snooze on your next alarm." },
    completionRate > 0 && completionRate < 75 && { priority: "High impact", accent: "#f59e0b", title: "Finish the alarm session", insight: `Your completion rate is ${completionRate}%, so some wake-ups are ending before the routine is complete.`, action: "Choose a slightly easier first challenge and complete it before opening other apps.", measure: "Target 75% or higher completion this week." },
    accuracy < 60 && totalAttempts > 0 && { priority: "Practice focus", accent: "#a78bfa", title: "Build confidence with a steady pace", insight: `Your challenge accuracy is ${accuracy.toFixed(0)}%, leaving room for more deliberate first attempts.`, action: "Read each prompt once, then answer without rushing; start with a challenge type you know well.", measure: "Aim to improve accuracy by 5 points." },
    weakTopic && weakTopic.accuracy < 65 && { priority: "Skill focus", accent: weakTopic.color, title: `Strengthen ${weakTopic.name}`, insight: `${weakTopic.name} is currently your weakest active topic at ${weakTopic.accuracy.toFixed(0)}% accuracy.`, action: `Use ${weakTopic.name} for one focused practice session after your next wake-up.`, measure: "Complete 3 attempts before changing topics." },
    sa < 70 && { priority: "Routine focus", accent: "#38bdf8", title: "Protect a consistent schedule", insight: `Schedule adherence is ${sa.toFixed(0)}%, so your alarm timing is still settling into a rhythm.`, action: "Keep tomorrow's alarm within 30 minutes of today's planned wake-up time.", measure: "Repeat the same wake-up window for three days." },
  ].filter(Boolean);
  const primaryRecommendation = recommendationCandidates[0] || { priority: "Momentum", accent: "#34d399", title: "Protect your momentum", insight: `Your ${habitScore.toFixed(0)} habit score shows a routine that is taking shape.`, action: "Keep the next alarm time unchanged and complete the first challenge before checking notifications.", measure: "Maintain your current streak tomorrow." };
  const supportingRecommendations = recommendationCandidates.slice(1, 3);
  const actionPlan = [
    { stage: "Tonight", action: primaryRecommendation.action, reason: primaryRecommendation.insight },
    { stage: "At the alarm", action: totalSnoozes > 0 ? "Stand up before starting the first challenge and leave the snooze button untouched." : "Start the first challenge before opening messages or social apps.", reason: totalSnoozes > 0 ? `${snoozeRate}% of alarm sessions include a snooze; a physical reset makes the routine easier to complete.` : "A focused first minute helps preserve the routine you have built." },
    { stage: "After completion", action: weakTopic ? `Give ${weakTopic.name} one focused attempt while you are alert.` : "Check the performance trend after your next completed session.", reason: primaryRecommendation.measure },
  ];
  const performanceTopics = [
    { title: "Habit Score", text: "Your consistency and streak", accent: "#818cf8", value: `${habitScore.toFixed(1)} / 100`, ref: habitRef },
    { title: "Puzzle Performance", text: "Challenge accuracy by topic", accent: "#c084fc", value: `${accuracy.toFixed(0)}% accurate`, ref: topicsRef },
    { title: "Alarm Behaviour", text: "Completion and snooze trends", accent: "#34d399", value: `${completionRate}% completed`, ref: behavioralRef },
    { title: "Recommendations", text: "Your next best actions", accent: "#f472b6", value: `${recommendationCandidates.length || 1} focus area`, ref: recommendationRef },
  ];
  const nextAlarmPlan = totalSnoozes > 3
    ? [
        { stage: "Prepare tonight", action: "Place your phone away from the bed before sleeping.", reason: `${totalSnoozes} snoozes recorded — reduce the temptation to delay.` },
        { stage: "When the alarm rings", action: "Start the first challenge before checking notifications.", reason: "A quick mental task helps you become alert sooner." },
        { stage: "Finish the wake-up", action: "Stand up after the first alarm and skip the next snooze.", reason: "This directly improves your snooze-reduction score." },
      ]
    : accuracy < 40
      ? [
        { stage: "Prepare tonight", action: "Keep your next alarm at the same time as today.", reason: "A stable schedule supports a stronger habit score." },
        { stage: "When the alarm rings", action: "Take a moment to read the cognitive challenge fully.", reason: `${accuracy.toFixed(0)}% accuracy shows that a calmer first attempt will help.` },
        { stage: "Finish the wake-up", action: "Complete the first challenge before using other apps.", reason: "This builds a reliable alarm-completion routine." },
      ]
    : [
        { stage: "Prepare tonight", action: "Keep your planned alarm time unchanged.", reason: "Your current routine is moving in the right direction." },
        { stage: "When the alarm rings", action: "Complete the first challenge without snoozing.", reason: "This protects your current wake-up streak." },
        { stage: "Finish the wake-up", action: "Check your completion trend after the next alarm session.", reason: "Use the graph to spot changes early." },
      ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 34, maxWidth: 1150, margin: "0 auto", paddingBottom: 60 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", padding: "28px", border: "1px solid rgba(129,140,248,0.42)", borderRadius: 24, background: "radial-gradient(circle at 86% 18%, rgba(244,114,182,0.3), transparent 25%), radial-gradient(circle at 67% 110%, rgba(56,189,248,0.18), transparent 30%), linear-gradient(120deg, rgba(99,102,241,0.3), rgba(15,23,42,0.55) 48%, rgba(236,72,153,0.2))", boxShadow: "0 20px 45px rgba(15,23,42,0.38)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ color: "#c4b5fd", fontSize: 11, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 7 }}>CognitiveWake Insights</div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: 0 }}>Cognitive Alarm Performance</h2>
          <p style={{ fontSize: 13, color: "#cbd5e1", margin: "5px 0 0" }}>Your habit score, wake-up behaviour, and personalised recommendations.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 17 }}>
            {performanceTopics.map(topic => <button key={topic.title} onClick={() => scrollToSection(topic.ref)} style={{ cursor: "pointer", padding: "7px 11px", borderRadius: 9, border: `1px solid ${topic.accent}70`, background: `${topic.accent}1c`, color: "#f8fafc", fontSize: 11, fontWeight: 800 }}>{topic.title} <span style={{ color: topic.accent }}>↓</span></button>)}
          </div>
        </div>
        <div className="performance-header-actions" style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
          <div className="performance-header-streak" style={{ textAlign: "right", paddingRight: 12, borderRight: "1px solid rgba(255,255,255,0.16)" }}><div style={{ color: "#fef3c7", fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase" }}>Current streak</div><div style={{ color: "#fff", fontSize: 21, fontWeight: 900 }}>{streak} <span style={{ color: "#fcd34d", fontSize: 12 }}>days</span></div></div>
          <button className="performance-refresh-button" onClick={handleRefresh} disabled={refreshing} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.22)", color: "#fff", fontWeight: 800, padding: "9px 16px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><RefreshCw size={13} className={refreshing ? "spin" : ""} /> Refresh</button>
        </div>
      </header>

      <section className="performance-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        {summaryStats.map((stat, index) => <div className={`performance-summary-card performance-summary-card-${index + 1}`} key={stat.label} style={{ minHeight: 122, padding: "18px", borderRadius: 18, background: `linear-gradient(145deg, ${stat.color}22, rgba(15,23,42,0.68))`, border: `1px solid ${stat.color}42`, boxShadow: `0 12px 26px ${stat.color}12`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span className="performance-summary-label" style={{ color: "#cbd5e1", fontSize: 11, fontWeight: 900, letterSpacing: 0.7, textTransform: "uppercase" }}>{stat.label}</span><span className="performance-summary-dot" style={{ width: 9, height: 9, borderRadius: "50%", background: stat.color, boxShadow: `0 0 12px ${stat.color}` }} /></div><strong className="performance-summary-value" style={{ color: "#fff", fontSize: index === 1 ? 27 : 31, letterSpacing: "-0.8px", marginTop: 10 }}>{stat.value}</strong><span className="performance-summary-detail" style={{ color: stat.color, fontSize: 11, fontWeight: 700 }}>{stat.detail}</span></div>)}
      </section>

      <div style={{ padding: "13px 17px", borderLeft: "3px solid #818cf8", borderRadius: "0 12px 12px 0", background: "linear-gradient(90deg, rgba(129,140,248,0.13), rgba(15,23,42,0.16))", color: "#cbd5e1", fontSize: 13, lineHeight: 1.55 }}><strong style={{ color: "#e0e7ff" }}>Your performance snapshot:</strong> review your habit, understand alarm behaviour, and use the tailored plan to improve your next wake-up.</div>

      <section ref={habitRef} style={{ display: "flex", flexDirection: "column", gap: 18, padding: "24px", borderRadius: 20, background: "linear-gradient(145deg, rgba(99,102,241,0.14), rgba(15,23,42,0.5))", border: "1px solid rgba(129,140,248,0.32)" }}>
        <div style={{ borderBottom: "1px solid rgba(52,211,153,0.28)", paddingBottom: 12 }}>
          <h3 style={{ fontSize: 23, fontWeight: 900, color: "#a5b4fc", margin: 0 }}>Habit Score</h3>
          <span style={{ fontSize: 12, color: "#64748b" }}>How consistently you follow your cognitive alarm routine</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px 36px", alignItems: "center" }}>
          <div style={{ borderBottom: "1px solid rgba(129,140,248,0.35)", paddingBottom: 12 }}>
            <HabitScoreGauge score={habitScore} tier={habitTier} streak={streak} />
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 10 }}>Score details</div>
            <strong style={{ fontSize: 42, color: "#a5b4fc" }}>{habitScore.toFixed(1)}<span style={{ fontSize: 15, color: "#64748b" }}> / 100</span></strong>
            <div style={{ color: "#f9a8d4", fontSize: 13, fontWeight: 700 }}>{habitTier} · {streak} day streak</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
            {habitFactors.map(f => (
              <div key={f.label} style={{ padding: 15, minHeight: 112, borderRadius: 14, border: `1px solid ${f.color}45`, background: `linear-gradient(145deg, ${f.color}18, rgba(15,23,42,0.5))`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#e2e8f0", fontSize: 12, fontWeight: 800 }}><span style={{ color: f.color, display: "grid", placeItems: "center", width: 27, height: 27, borderRadius: 8, background: `${f.color}22` }}>{f.icon}</span>{f.label}</div>
                  <span style={{ color: f.color, fontWeight: 900, fontSize: 14 }}>{f.value.toFixed(0)}%</span>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: 10, fontWeight: 700, marginBottom: 6 }}><span>Contribution</span><span>{f.pct}% of score</span></div>
                  <div style={{ height: 7, background: "rgba(255,255,255,0.08)", borderRadius: 6, overflow: "hidden" }}><div style={{ width: `${Math.min(100, f.value)}%`, height: "100%", background: `linear-gradient(90deg, ${f.color}a8, ${f.color})`, borderRadius: 6, transition: "width 0.8s ease" }} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section ref={topicsRef} style={{ display: "flex", flexDirection: "column", gap: 18, padding: "24px", borderRadius: 20, background: "linear-gradient(145deg, rgba(192,132,252,0.12), rgba(15,23,42,0.5))", border: "1px solid rgba(192,132,252,0.28)" }}>
        <div style={{ borderBottom: "1px solid rgba(192,132,252,0.32)", paddingBottom: 12 }}>
          <h3 style={{ fontSize: 23, fontWeight: 900, color: "#d8b4fe", margin: 0 }}>Puzzle Performance</h3>
          <span style={{ fontSize: 12, color: "#64748b" }}>Solved puzzles and accuracy for each cognitive challenge topic</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {puzzleTopics.map(topic => (
            <div key={topic.id} style={{ background: `linear-gradient(145deg, ${topic.color}1f, rgba(15,23,42,0.55))`, border: `1px solid ${topic.color}42`, borderRadius: 16, padding: 18, boxShadow: `0 10px 24px ${topic.color}10` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ color: "#f8fafc", fontWeight: 800, fontSize: 15 }}>{topic.name}</div>
                <span style={{ color: topic.color, fontSize: 12, fontWeight: 900 }}>{topic.accuracy.toFixed(0)}%</span>
              </div>
              <div style={{ color: "#fff", fontSize: 27, fontWeight: 900, marginTop: 18 }}>{topic.correct}<span style={{ color: "#64748b", fontSize: 13, fontWeight: 600 }}> solved</span></div>
              <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{topic.attempts} total attempts</div>
              <div style={{ height: 7, background: "rgba(255,255,255,0.08)", borderRadius: 6, overflow: "hidden", marginTop: 15 }}><div style={{ height: "100%", width: `${Math.min(100, topic.accuracy)}%`, background: `linear-gradient(90deg, ${topic.color}aa, ${topic.color})`, borderRadius: 6, transition: "width 0.8s ease" }} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="behavioral-analytics-section" ref={behavioralRef} style={{ display: "flex", flexDirection: "column", gap: 18, padding: "24px", borderRadius: 20, background: "linear-gradient(145deg, rgba(52,211,153,0.12), rgba(15,23,42,0.5))", border: "1px solid rgba(52,211,153,0.28)" }}>
        <div style={{ borderBottom: "1px solid rgba(129,140,248,0.28)", paddingBottom: 12 }}>
          <h3 style={{ fontSize: 23, fontWeight: 900, color: "#6ee7b7", margin: 0 }}>Alarm Behaviour Analytics</h3>
          <span style={{ fontSize: 12, color: "#64748b" }}>{completedAlarms} of {totalAlarmSessions} alarm sessions completed · {completionRate}% completion rate · {totalSnoozes} snoozes</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "9px 12px", borderRadius: 12, background: "rgba(15,23,42,0.34)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>Choose the trend window to explore your routine.</span>
          <div style={{ display: "flex", padding: 3, borderRadius: 9, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255,255,255,0.09)" }}>
            {[{ id: "weekly", label: "7 days" }, { id: "monthly", label: "30 days" }].map(option => <button key={option.id} onClick={() => setTimeFrame(option.id)} style={{ border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 11, fontWeight: 800, color: timeFrame === option.id ? "#fff" : "#64748b", background: timeFrame === option.id ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent" }}>{option.label}</button>)}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28, alignItems: "center", paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <AlarmOutcomeChart completed={completedAlarms} total={totalAlarmSessions} snoozes={totalSnoozes} />
          <div style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.7 }}>
            <div style={{ color: "#f8fafc", fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Wake-up insight</div>
            <div>Completion shows how often you finish an alarm session. Snooze activity helps identify when your wake-up routine needs adjustment.</div>
          </div>
        </div>
        {filteredTimeseries.length < 2 ? (
          <p style={{ color: "#64748b", margin: 0 }}>Complete more alarm sessions to see your wake-up trend.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            <LineChart data={filteredTimeseries} dataKey="wake_consistency" color="#818cf8" label="Wake-up completion" sublabel="Completed alarms compared with alarm triggers" yMax={100} />
            <LineChart data={filteredTimeseries} dataKey="snooze_count" color="#f59e0b" label="Snooze activity" sublabel="Snoozes recorded each day" yMax={5} />
          </div>
        )}
        <div style={{ paddingTop: 4 }}><DailyAlarmsBarChart data={filteredTimeseries} /></div>
      </section>

      <section ref={recommendationRef} style={{ display: "flex", flexDirection: "column", gap: 18, padding: "24px", borderRadius: 20, background: "linear-gradient(145deg, rgba(244,114,182,0.15), rgba(15,23,42,0.55))", border: "1px solid rgba(244,114,182,0.35)" }}>
        <div style={{ borderBottom: "1px solid rgba(244,114,182,0.28)", paddingBottom: 12 }}>
          <h3 style={{ fontSize: 23, fontWeight: 900, color: "#f9a8d4", margin: 0 }}>Recommendations</h3>
          <span style={{ fontSize: 12, color: "#64748b" }}>A tailored focus and practical actions for your next wake-up</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 18, padding: "20px 0", borderBottom: "1px solid rgba(244,114,182,0.25)" }}>
          <div style={{ padding: "18px 20px", borderRadius: 16, background: `linear-gradient(135deg, ${primaryRecommendation.accent}30, rgba(99,102,241,0.15))`, border: `1px solid ${primaryRecommendation.accent}80` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><div style={{ color: primaryRecommendation.accent, fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase" }}>Your top priority</div><span style={{ color: primaryRecommendation.accent, border: `1px solid ${primaryRecommendation.accent}70`, borderRadius: 99, padding: "3px 8px", fontSize: 10, fontWeight: 800 }}>{primaryRecommendation.priority}</span></div>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 18, marginTop: 11 }}>{primaryRecommendation.title}</div>
            <p style={{ margin: "7px 0 0", color: "#cbd5e1", fontSize: 13, lineHeight: 1.55 }}>{primaryRecommendation.insight}</p>
            <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(15,23,42,0.35)", color: "#fff", fontSize: 13, lineHeight: 1.5, fontWeight: 700 }}>{primaryRecommendation.action}</div>
            <div style={{ color: primaryRecommendation.accent, fontSize: 11, fontWeight: 800, marginTop: 10 }}>Success marker: {primaryRecommendation.measure}</div>
          </div>
          <div style={{ padding: "18px 20px", borderRadius: 16, background: "rgba(15,23,42,0.45)", border: "1px solid rgba(129,140,248,0.3)" }}>
            <div style={{ color: "#a5b4fc", fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Your wake-up routine</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {actionPlan.map((step, index) => (
                <div key={step.stage} style={{ padding: "10px 0", borderBottom: index < actionPlan.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                  <div style={{ color: "#f9a8d4", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.7 }}>{step.stage}</div>
                  <div style={{ color: "#f8fafc", fontSize: 13, fontWeight: 700, marginTop: 3 }}>{step.action}</div>
                  <div style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.45, marginTop: 3 }}>{step.reason}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {supportingRecommendations.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
            {supportingRecommendations.map(rec => <div key={rec.title} style={{ padding: 14, borderRadius: 13, border: `1px solid ${rec.accent}45`, background: "rgba(15,23,42,0.28)" }}><div style={{ color: rec.accent, fontSize: 10, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase" }}>{rec.priority}</div><div style={{ color: "#f8fafc", fontWeight: 800, fontSize: 14, marginTop: 5 }}>{rec.title}</div><div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.45, marginTop: 5 }}>{rec.action}</div></div>)}
          </div>
        )}
        {recHistory.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 800 }}>Recent recommendations</div>
            {recHistory.slice(0, 3).map((rec, i) => (
              <div key={rec.id || i} style={{ display: "flex", justifyContent: "space-between", gap: 16, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <span style={{ color: "#cbd5e1", fontSize: 13 }}>{rec.message}</span>
                <span style={{ color: "#64748b", fontSize: 11, whiteSpace: "nowrap" }}>{fmtDate(rec.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36, maxWidth: 1150, margin: "0 auto", paddingBottom: 60 }}>

      {/* ── HEADER & NAVIGATION ANCHORS ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
        paddingBottom: 18, borderBottom: "2px solid rgba(129,140,248,0.4)"
      }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>
            Your Performance
          </h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            Track your habits, activity trends, challenge accuracy, and recommendations.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => scrollToSection(habitRef)}
            style={{ background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.3)", color: "#c084fc", fontWeight: 700, padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontSize: 12 }}
          >
            Habit Overview
          </button>
          <button
            onClick={() => scrollToSection(behavioralRef)}
            style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", fontWeight: 700, padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontSize: 12 }}
          >
            Behavioral Trends
          </button>
          <button
            onClick={() => scrollToSection(topicsRef)}
            style={{ background: "rgba(236,72,153,0.12)", border: "1px solid rgba(236,72,153,0.3)", color: "#f472b6", fontWeight: 700, padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontSize: 12 }}
          >
            Topic Charts
          </button>
          <button
            onClick={() => scrollToSection(recommendationRef)}
            style={{ background: "rgba(244,114,182,0.12)", border: "1px solid rgba(244,114,182,0.3)", color: "#f472b6", fontWeight: 700, padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontSize: 12 }}
          >
            Recommendations
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#e2e8f0", fontWeight: 700, padding: "8px 16px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
          >
            <RefreshCw size={13} className={refreshing ? "spin" : ""} />
            Refresh
          </button>
        </div>
      </div>


      {/* ══════════════════════════════════════════════════════
         SECTION: HABIT TRACKING OVERVIEW
         (Wake-Up Consistency presented ONCE here in 35% scoring factor breakdown)
         ══════════════════════════════════════════════════════ */}
      <section ref={habitRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 12 }}>
          <div style={{ background: "rgba(129,140,248,0.15)", padding: 8, borderRadius: 12, color: "#818cf8" }}>
            <Flame size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: 22, fontWeight: 900, color: "#a5b4fc", margin: 0, letterSpacing: "0.2px" }}>Habit Tracking Overview</h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>Cognitive habit score evaluation &amp; weighted factor breakdown</span>
          </div>
        </div>

        {/* Top Habit Grid: Hero Banner + 2x2 Quick Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>

          {/* Left Hero Card */}
          <div style={{
            borderBottom: "1px solid rgba(129,140,248,0.35)", padding: "8px 0 20px",
            display: "flex", flexDirection: "column", justifyContent: "space-between"
          }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#818cf8", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 }}>
                    Overall Cognitive Habit Score
                  </div>
                  <div style={{ fontSize: 52, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                    {habitScore.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f472b6", marginTop: 6 }}>
                    {habitTier}
                  </div>
                </div>
                <div className="current-streak-summary" style={{ padding: "4px 0", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Current Streak</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: "#f472b6" }}>{streak} <span style={{ fontSize: 12, color: "#94a3b8" }}>days</span></div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <div style={{ width: "100%", background: "rgba(255,255,255,0.08)", height: 10, borderRadius: 6, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, habitScore)}%`, height: "100%", background: "linear-gradient(90deg, #818cf8, #f472b6)", borderRadius: 6, transition: "width 1s ease" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b", marginTop: 6, fontWeight: 600 }}>
                <span>0 (Erratic)</span>
                <span>100 (Master Riser)</span>
              </div>
            </div>
          </div>

          {/* Right 2x2 Quick Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <MiniCard icon="🔔" accent="#f59e0b" title="TOTAL ALARMS" value={totalAlarms} sub="Configured alarm triggers" />
            <MiniCard icon="🎯" accent="#34d399" title="PUZZLES SOLVED" value={puzzlesSolved} sub={`out of ${totalAttempts} attempts`} />
            <MiniCard icon="🔥" accent="#f472b6" title="STREAK DAYS" value={`${streak} Days`} sub="Consecutive morning wake-ups" />
            <MiniCard icon="✅" accent="#818cf8" title="ACCURACY RATE" value={`${(data?.accuracy_rate ?? 0).toFixed(1)}%`} sub="Overall challenge accuracy" />
          </div>

        </div>

        {/* Weighted Scoring Factors — Wake-Up Consistency presented ONCE here */}
        <div style={{ paddingBottom: 18, borderBottom: "1px solid rgba(129,140,248,0.25)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc", marginBottom: 16 }}>Habit Score Factor Breakdown</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
            {habitFactors.map(f => (
              <div key={f.label} style={{ padding: "8px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>
                    <span style={{ color: f.color }}>{f.icon}</span> {f.label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: f.color }}>{f.value.toFixed(1)}%</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.06)", height: 7, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, f.value)}%`, height: "100%", background: f.color, borderRadius: 4, transition: "width 1s ease" }} />
                </div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 6, fontWeight: 600 }}>Weight Contribution: {f.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════
         SECTION: BEHAVIORAL ANALYTICS
         (Mini Cards feature AVG RESPONSE SPEED instead of duplicating Wake-Up Consistency)
         ══════════════════════════════════════════════════════ */}
      <section ref={behavioralRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 12, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: "rgba(52,211,153,0.15)", padding: 8, borderRadius: 12, color: "#34d399" }}>
              <Brain size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 22, fontWeight: 900, color: "#6ee7b7", margin: 0, letterSpacing: "0.2px" }}>Behavioral Analytics</h3>
              <span style={{ fontSize: 12, color: "#64748b" }}>Time-series behavior trends and comparative accuracy bar charts</span>
            </div>
          </div>

          {/* ── Weekly / Monthly Toggle Switch ── */}
          <div style={{ display: "flex", alignItems: "center", background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 30, padding: 4 }}>
            <button
              onClick={() => setTimeFrame("weekly")}
              style={{
                background: timeFrame === "weekly" ? "linear-gradient(135deg, #34d399, #059669)" : "transparent",
                color: timeFrame === "weekly" ? "#fff" : "#94a3b8",
                border: "none",
                borderRadius: 24,
                padding: "7px 18px",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s",
                boxShadow: timeFrame === "weekly" ? "0 2px 10px rgba(52,211,153,0.3)" : "none"
              }}
            >
              <Calendar size={13} /> Weekly (7 Days)
            </button>
            <button
              onClick={() => setTimeFrame("monthly")}
              style={{
                background: timeFrame === "monthly" ? "linear-gradient(135deg, #818cf8, #4f46e5)" : "transparent",
                color: timeFrame === "monthly" ? "#fff" : "#94a3b8",
                border: "none",
                borderRadius: 24,
                padding: "7px 18px",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s",
                boxShadow: timeFrame === "monthly" ? "0 2px 10px rgba(129,140,248,0.3)" : "none"
              }}
            >
              <Calendar size={13} /> Monthly (30 Days)
            </button>
          </div>
        </div>

        {/* 4 Distinct Behavioral Mini Cards (No duplicated Wake-Up Consistency) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <MiniCard
            icon="📅"
            accent="#34d399"
            title={`${timeFrame.toUpperCase()} ALARMS`}
            value={totalTriggersInView}
            sub={`${timeFrame === "weekly" ? "7-day" : "30-day"} active alarm triggers`}
          />
          <MiniCard
            icon="😴"
            accent="#f472b6"
            title={`${timeFrame.toUpperCase()} SNOOZES`}
            value={totalSnoozesInView}
            sub={totalSnoozesInView === 0 ? "Zero snoozes recorded!" : "Total snooze button hits"}
          />
          <MiniCard
            icon="⏱️"
            accent="#818cf8"
            title="RESPONSE SPEED"
            value={`${Number(meanResponseTime).toFixed(1)}s`}
            sub="Average puzzle dismissal time"
          />
          
        </div>


        {/* Daily Alarms Bar Chart */}
        <DailyAlarmsBarChart data={filteredTimeseries} />

        {/* Line Charts Container */}
        <div style={{ padding: "4px 0 22px", borderBottom: "1px solid rgba(129,140,248,0.25)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#34d399", textTransform: "uppercase", letterSpacing: 1 }}>
                Behavior Patterns — {timeFrame === "weekly" ? "7 Day View" : "30 Day View"}
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginTop: 2 }}>Daily Metric Trend Lines</div>
            </div>
            <span style={{ fontSize: 11, color: "#64748b", background: "rgba(255,255,255,0.04)", padding: "4px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
              Plotting {filteredTimeseries.length} data points
            </span>
          </div>

          {filteredTimeseries.length < 2 ? (
            <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "40px 0", background: "rgba(0,0,0,0.2)", borderRadius: 14 }}>
              Not enough daily logs recorded yet for this view. Complete alarm challenges to render trend graphs.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
              <LineChart data={filteredTimeseries} dataKey="wake_consistency"   color="#818cf8" label="Wake-Up Consistency (%)"  sublabel="Completed wake-ups vs alarm triggers" yMax={100} />
              <LineChart data={filteredTimeseries} dataKey="snooze_count"       color="#f472b6" label="Snooze Pattern"             sublabel="Daily snooze button count" yMax={10} />
              <LineChart data={filteredTimeseries} dataKey="challenge_activity" color="#34d399" label="Challenge Activity"         sublabel="Daily puzzles attempted" yMax={15} />
                          </div>
          )}
        </div>

      </section>

      {/* ══════════════════════════════════════════════════════
         SECTION: TOPIC DISTRIBUTION PIE CHART
         ══════════════════════════════════════════════════════ */}
      <section ref={topicsRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 12 }}>
          <div style={{ background: "rgba(236,72,153,0.15)", padding: 8, borderRadius: 12, color: "#ec4899" }}>
            <PieChart size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: 22, fontWeight: 900, color: "#f9a8d4", margin: 0, letterSpacing: "0.2px" }}>Topic Distribution</h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>Interactive pie chart showing attempt distribution across puzzle topics, habit pillars &amp; time of day</span>
          </div>
        </div>

        <TopicPieChart
          puzzleBreakdown={data?.puzzle_breakdown}
          habitFactors={habitFactors}
          timeOfDayStats={data?.time_of_day_stats}
        />
      </section>


      {/* ══════════════════════════════════════════════════════
         SECTION: ADAPTIVE RECOMMENDATIONS
         ══════════════════════════════════════════════════════ */}
      <section ref={recommendationRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 12 }}>
          <div style={{ background: "rgba(244,114,182,0.15)", padding: 8, borderRadius: 12, color: "#f472b6" }}>
            <Sparkles size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: 22, fontWeight: 900, color: "#f9a8d4", margin: 0, letterSpacing: "0.2px" }}>Recommendations</h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>AI-generated cognitive tips and recommendation snapshot history</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>

          {/* Active Recommendation */}
          <div style={{
            borderBottom: "1px solid rgba(129,140,248,0.25)", padding: "6px 0 20px",
            display: "flex", flexDirection: "column", justifyContent: "space-between"
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#818cf8", textTransform: "uppercase", letterSpacing: 1 }}>Current Active Recommendation</span>
                <span style={{ fontSize: 24 }}>💡</span>
              </div>
              <p style={{ fontSize: 15, color: "#e2e8f0", lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
                "{currentRecMsg}"
              </p>
            </div>

            <div style={{ marginTop: 24, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#64748b" }}>Auto-generated by AI Engine</span>
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{new Date().toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Recommendation Logs */}
          <div style={{ padding: "6px 0 20px", borderBottom: "1px solid rgba(244,114,182,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc" }}>Recommendation History Logs</div>
              <Clock size={16} color="#64748b" />
            </div>

            {recHistory.length === 0 ? (
              <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "30px 0" }}>
                No previous history entries logged yet. Keep using CognitiveWake to generate automated recommendation snapshots.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                {recHistory.map((rec, i) => (
                  <div key={rec.id || i} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <span style={{ fontSize: 18, marginTop: 1 }}>{catIcon(rec.category)}</span>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 3 }}>{rec.category}</div>
                          <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>{rec.message}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: "#475569", whiteSpace: "nowrap", flexShrink: 0 }}>{fmtDate(rec.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </section>

    </div>
  );
}

export default Progress;
