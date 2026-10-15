// Small shared pieces used by several pages.
export function Loading({ text = "Loading..." }) {
  return <div className="page-note">{text}</div>;
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return <div className="challenge-error">{message}</div>;
}

export function Empty({ title, children }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function pct(value) {
  return value === null || value === undefined ? "–" : `${Math.round(value)}`;
}

export function formatDateTime(value) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatClock(hhmm) {
  if (!hhmm) return { time: "–", period: "" };
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { time: `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}`, period };
}

export function titleCase(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, " ");
}

export function minutesLabel(minutes) {
  if (minutes === null || minutes === undefined) return "–";
  return `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, "0")}m`;
}

export const RECURRENCE_LABELS = {
  once: "One-time",
  daily: "Every day",
  weekdays: "Weekdays",
  weekends: "Weekends",
  smart: "Smart adaptive",
};

export const CHALLENGE_LABELS = {
  math: "Math",
  logic: "Logic",
  memory: "Memory",
  word: "Word",
  pattern: "Pattern",
  riddle: "Riddle",
  quiz: "Quick quiz",
};

export const DIFFICULTIES = ["beginner", "easy", "medium", "hard", "expert"];
