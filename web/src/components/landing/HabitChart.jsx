import React from 'react';
import useReveal from './useReveal';

const W = 640;
const H = 250;
const PAD = { top: 16, right: 20, bottom: 30, left: 24 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;
const MAX = 100;

/**
 * Lightweight SVG area/line chart for the landing insights section.
 * Illustrative weekly habit-score trend (0–100). Pure SVG — no chart library —
 * so it renders crisply and stays dependency-free while matching the app's
 * indigo/mint language. Draws in once it scrolls into view.
 */
export default function HabitChart({ data }) {
  const [ref, visible] = useReveal();

  const count = data.length;
  const xAt = i => PAD.left + (i / Math.max(1, count - 1)) * plotW;
  const yAt = score => PAD.top + (1 - Math.max(0, Math.min(score, MAX)) / MAX) * plotH;

  const pts = data.map((d, i) => ({ x: xAt(i), y: yAt(d.score), ...d }));
  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const baselineY = PAD.top + plotH;
  const area = `${line} L${pts[count - 1].x.toFixed(1)},${baselineY.toFixed(1)} L${pts[0].x.toFixed(1)},${baselineY.toFixed(1)} Z`;
  const last = pts[count - 1];

  return (
    <div ref={ref} className={`lp-chart reveal ${visible ? 'is-visible' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weekly habit score trend from 0 to 100 over the last seven days (sample data)">
        <defs>
          <linearGradient id="lp-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6844FD" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#6844FD" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 50, 100].map(tick => (
          <g key={tick}>
            <line
              className="lp-chart__grid"
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yAt(tick)}
              y2={yAt(tick)}
            />
            <text className="lp-chart__ylabel" x={PAD.left - 8} y={yAt(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}

        <path className="lp-chart__area" d={area} />
        <path
          className={`lp-chart__line ${visible ? 'is-drawn' : ''}`}
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset="1"
          d={line}
        />
        <circle className="lp-chart__dot lp-chart__dot--last" cx={last.x} cy={last.y} r="5" />
        {pts.map(p => (
          <g key={p.day}>
            <circle className="lp-chart__dot" cx={p.x} cy={p.y} r="3.5">
              <title>{`${p.day}: ${p.score}/100`}</title>
            </circle>
            <text className="lp-chart__day" x={p.x} y={H - 8} textAnchor="middle">
              {p.day}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}