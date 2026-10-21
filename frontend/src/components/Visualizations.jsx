import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import {
  Card,
  EmptyState,
} from "./ChartKit";
import { COLORS, pieColors, tooltipStyle, gridStroke, axisTick } from "./chartTokens";

export default function Visualizations({ performance }) {
  const accuracyData = performance?.accuracy_timeline || [];
  const readinessData = (performance?.readiness || []).filter(
    (item) => Number.isFinite(item.score)
  );
  const wakeData = performance?.wake_quality || [];
  const typeData = performance?.challenge_type_distribution || [];

  if (!accuracyData.length && !readinessData.length && !wakeData.length && !typeData.length) {
    return (
      <Card wide>
        <EmptyState
          icon="🧠"
          title="No activity recorded yet"
          description="Complete scheduled alarms and cognitive challenges to generate insights into your wake quality and accuracy."
        />
      </Card>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
        gap: 20,
      }}
    >
      <Card title="Challenge Accuracy" subtitle="Historical score trends across wake challenges">
        {accuracyData.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={accuracyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} unit="%" />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                dataKey="score"
                type="monotone"
                stroke={COLORS.primary}
                strokeWidth={2.5}
                dot={{ r: 4, fill: COLORS.primary }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            icon="🎯"
            title="No Accuracy Data"
            description="Answer challenges to track your accuracy over time."
          />
        )}
      </Card>

      <Card title="Cognitive Readiness" subtitle="Holistic readiness breakdown">
        {readinessData.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={readinessData} outerRadius="70%">
              <PolarGrid stroke={gridStroke} />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Radar
                dataKey="score"
                stroke={COLORS.cyan}
                fill={COLORS.cyan}
                fillOpacity={0.25}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            icon="📊"
            title="Readiness Pending"
            description="Complete alarms to calculate your cognitive readiness index."
          />
        )}
      </Card>

      <Card title="Challenge Distribution" subtitle="Mix of puzzle categories solved">
        {typeData.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={4}
                dataKey="value"
                stroke="rgba(8, 11, 19, 0.8)"
              >
                {typeData.map((_, i) => (
                  <Cell key={i} fill={pieColors[i % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            icon="🧩"
            title="No Category Data"
            description="Take math, memory, or logic tests to view your distribution."
          />
        )}
      </Card>

      <Card title="Wake Activity" subtitle="Immediate wake completions vs snoozes">
        {wakeData.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={wakeData} margin={{ left: -20, right: 8, top: 10, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={32} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              <Bar dataKey="instant" name="Completed" stackId="a" fill={COLORS.primary} radius={[0, 0, 4, 4]} />
              <Bar dataKey="snoozed" name="Snoozed" stackId="a" fill={COLORS.rose} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            icon="⏰"
            title="No Wake History"
            description="Snoozes and alarm completions will form your wake habit history."
          />
        )}
      </Card>
    </div>
  );
}