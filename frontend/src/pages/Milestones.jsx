import { PageShell, Card, StatCard } from "../components/ChartKit";
import { statGrid } from "../components/chartTokens";

const milestoneData = [
  {
    title: "Milestone 1",
    subtitle: "Project Initialization, Design Process & Core Setup",
    status: "Completed",
    accent: "#8b5cf6",
    tasks: [
      "Define project objectives and cognitive alarm workflows.",
      "Design system architecture and database schema.",
      "Create UI wireframes and workflow planning.",
      "Set up frontend and backend environments.",
      "Implement authentication and role-based access system.",
      "Build user profile and habit management workflows.",
      "Develop alarm scheduling functionality.",
    ],
    outcomes: [
      "Understand intelligent alarm and habit formation workflows.",
      "Learn system architecture and database design concepts.",
      "Build frontend and backend project initialization.",
      "Working authentication and alarm scheduling system.",
    ],
  },
  {
    title: "Milestone 2",
    subtitle: "Cognitive Challenges & Verification System",
    status: "Completed",
    accent: "#22d3ee",
    tasks: [
      "Implement cognitive challenge engine.",
      "Build puzzle generation workflows.",
      "Develop wake-up verification mechanisms.",
      "Create challenge evaluation systems.",
      "Generate challenge analytics.",
    ],
    outcomes: [
      "Cognitive challenge engine operational.",
      "Wake-up verification workflows functional.",
      "Challenge evaluation system completed.",
    ],
  },
  {
    title: "Milestone 3",
    subtitle: "Adaptive Intelligence & Recommendations",
    status: "Completed",
    accent: "#22c55e",
    tasks: [
      "Implement adaptive difficulty engine.",
      "Build behavioral analytics workflows.",
      "Develop habit scoring models.",
      "Generate recommendation engine outputs.",
      "Create habit tracking dashboards.",
    ],
    outcomes: [
      "Adaptive difficulty engine operational.",
      "Habit scoring system functional.",
      "Recommendation workflows completed.",
    ],
  },
  {
    title: "Milestone 4",
    subtitle: "Analytics, Testing & Deployment",
    status: "Completed",
    accent: "#f59e0b",
    tasks: [
      "Build executive dashboards and analytics views.",
      "Add reporting and visualization modules.",
      "Run validation, milestone, and regression checks.",
      "Prepare Docker deployment and cloud-ready configuration.",
      "Document the final system and delivery-ready output.",
    ],
    outcomes: [
      "Executive dashboards and reporting operational.",
      "End-to-end cognitive alarm workflow validated.",
      "Deployment and testing readiness complete.",
      "Project output prepared for presentation and handoff.",
    ],
  },
];

function Milestones({ onBack }) {
  return (
    <PageShell
      eyebrow="Project Outputs"
      title="Milestone Delivery Checklist"
      subtitle="This project includes the key outputs expected from each milestone, with direct task and outcome tracking."
      onBack={onBack}
      backLabel="← Dashboard"
    >
      <div style={statGrid}>
        <StatCard icon="🏁" label="Milestones" value={String(milestoneData.length)} accent="#8b5cf6" />
        <StatCard icon="✅" label="Completed" value="4/4" accent="#22c55e" />
        <StatCard icon="🧠" label="Core Flow" value="Live" accent="#22d3ee" />
        <StatCard icon="📊" label="Outputs" value="All" accent="#ec4899" />
      </div>

      <div style={{ display: "grid", gap: 22 }}>
        {milestoneData.map((milestone) => (
          <Card
            key={milestone.title}
            title={milestone.title}
            subtitle={milestone.subtitle}
            badge={milestone.status}
            wide
            style={{ borderColor: `${milestone.accent}44` }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
              <div>
                <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 16 }}>Tasks</h3>
                <ul style={{ margin: 0, paddingLeft: 18, color: "#dbe4ff", lineHeight: 1.8 }}>
                  {milestone.tasks.map((task) => (
                    <li key={task}>{task}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 16 }}>Outcomes</h3>
                <ul style={{ margin: 0, paddingLeft: 18, color: "#dbe4ff", lineHeight: 1.8 }}>
                  {milestone.outcomes.map((outcome) => (
                    <li key={outcome}>{outcome}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}

export default Milestones;
