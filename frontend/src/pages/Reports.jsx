import { useEffect, useState } from "react";
import "../App.css";
import { apiFetch, downloadFile } from "../api";
import { useAuth } from "../auth";
import { ErrorBox } from "../components/ui";

const DESCRIPTIONS = {
  habit: "Habit score, its four parts and daily wake-up results.",
  wake_up: "Every wake-up verification with method, result and response time.",
  challenge: "Accuracy by challenge type and difficulty, plus recent attempts.",
  productivity: "Daily productivity check-ins and how they relate to wake-ups.",
  sleep: "Nightly sleep, bedtimes and schedule adherence.",
};

function Reports() {
  const { user } = useAuth();
  const [types, setTypes] = useState([]);
  const [report, setReport] = useState("habit");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/reports/types")
      .then((data) => setTypes(data.types))
      .catch((err) => setError(err.message));
  }, []);

  const download = async (kind) => {
    setBusy(kind);
    setError("");
    try {
      await downloadFile(
        `/reports/export.${kind}?report=${report}&days=${days}&user_id=${user.id}`,
        `${report}_report.${kind}`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const downloadAll = async () => {
    setBusy("csv");
    setError("");
    try {
      await downloadFile(`/reports/export.csv?user_id=${user.id}`, "cognitive_alarm_data.csv");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">REPORTS AND EXPORT</p>
          <h1>Reports</h1>
          <p className="subtitle">Download your results as PDF or Excel.</p>
        </div>
      </div>

      <ErrorBox message={error} />

      <div className="challenge-type-grid">
        {types.map((type) => (
          <button
            key={type.id}
            className={`challenge-type-card ${report === type.id ? "active" : ""}`}
            onClick={() => setReport(type.id)}
          >
            <h3>{type.title}</h3>
            <p>{DESCRIPTIONS[type.id]}</p>
          </button>
        ))}
      </div>

      <div className="challenge-section">
        <h2>Period</h2>
        <div className="difficulty-buttons">
          {[7, 30, 90, 365].map((value) => (
            <button
              key={value}
              className={days === value ? "difficulty-button active" : "difficulty-button"}
              onClick={() => setDays(value)}
            >
              {value === 365 ? "1 year" : `${value} days`}
            </button>
          ))}
        </div>
      </div>

      <div className="report-actions">
        <button className="generate-button" onClick={() => download("pdf")} disabled={Boolean(busy)}>
          {busy === "pdf" ? "Preparing..." : "Download PDF"}
        </button>
        <button className="generate-button" onClick={() => download("xlsx")} disabled={Boolean(busy)}>
          {busy === "xlsx" ? "Preparing..." : "Download Excel"}
        </button>
        <button className="small-button" onClick={downloadAll} disabled={Boolean(busy)}>
          Export all my data (CSV)
        </button>
      </div>
    </div>
  );
}

export default Reports;
