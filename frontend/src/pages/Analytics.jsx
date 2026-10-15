import { useCallback, useEffect, useState } from "react";
import "../App.css";
import { apiFetch } from "../api";
import { useAuth } from "../auth";
import BarList from "../components/BarList";
import { Empty, ErrorBox, Loading, minutesLabel, titleCase } from "../components/ui";

const todayIso = () => new Date().toISOString().slice(0, 10);

function Analytics() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [dash, setDash] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [sleepForm, setSleepForm] = useState({
    sleep_date: todayIso(),
    bed_time: "23:00",
    wake_time: "07:00",
    quality: 4,
  });
  const [prodForm, setProdForm] = useState({
    log_date: todayIso(),
    rating: 7,
    tasks_planned: "",
    tasks_completed: "",
    focus_minutes: "",
  });

  const load = useCallback(async () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    const iso = (d) => d.toISOString().slice(0, 10);
    try {
      const [d, p] = await Promise.all([
        apiFetch(`/dashboards/user/${user.id}?start=${iso(start)}&end=${iso(end)}`),
        apiFetch(`/analytics/patterns/${user.id}?days=${days}`),
      ]);
      setDash(d);
      setPatterns(p);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [days, user.id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSleep = async (event) => {
    event.preventDefault();
    setError("");
    try {
      // Bedtime is on the evening before the wake-up date when it is later than the wake time.
      const wake = new Date(`${sleepForm.sleep_date}T${sleepForm.wake_time}`);
      let bed = new Date(`${sleepForm.sleep_date}T${sleepForm.bed_time}`);
      if (bed >= wake) bed = new Date(bed.getTime() - 24 * 3600 * 1000);
      const local = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
      await apiFetch("/tracking/sleep", {
        method: "POST",
        body: {
          user_id: user.id,
          sleep_date: sleepForm.sleep_date,
          bed_time: local(bed),
          wake_time: local(wake),
          quality: Number(sleepForm.quality),
        },
      });
      setNotice("Sleep saved.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveProductivity = async (event) => {
    event.preventDefault();
    setError("");
    const num = (v) => (v === "" ? null : Number(v));
    try {
      await apiFetch("/tracking/productivity", {
        method: "POST",
        body: {
          user_id: user.id,
          log_date: prodForm.log_date,
          rating: Number(prodForm.rating),
          tasks_planned: num(prodForm.tasks_planned),
          tasks_completed: num(prodForm.tasks_completed),
          focus_minutes: num(prodForm.focus_minutes),
        },
      });
      setNotice("Productivity check-in saved.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!dash || !patterns) {
    return <div className="page-container">{error ? <ErrorBox message={error} /> : <Loading />}</div>;
  }

  const habit = dash.habit;
  const labels = {
    wake_up_consistency: "Wake-up consistency",
    challenge_completion: "Challenge completion",
    snooze_reduction: "Snooze reduction",
    sleep_schedule_adherence: "Sleep schedule adherence",
  };
  const components = Object.keys(labels).map((key) => ({
    label: `${labels[key]} (${Math.round(habit.weights[key] * 100)}%)`,
    value: habit.components[key],
  }));
  const dailyWake = dash.trends.daily.slice(-14).map((d) => ({
    label: d.date.slice(5),
    value: d.wake_success_rate_percent,
  }));
  const byType = dash.challenge_breakdown.by_type.map((t) => ({
    label: `${titleCase(t.name)} (${t.attempts})`,
    value: t.accuracy_percent,
  }));
  const byLevel = dash.difficulty.performance_by_level.map((t) => ({
    label: `${titleCase(t.name)} (${t.attempts})`,
    value: t.accuracy_percent,
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <p className="eyebrow">BEHAVIOR ANALYTICS</p>
          <h1>Analytics</h1>
          <p className="subtitle">Understand your wake-up, snooze, sleep and productivity patterns.</p>
        </div>
        <select className="period" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <ErrorBox message={error} />
      {notice && <div className="notice-box">{notice}</div>}

      <div className="two-column">
        <section className="alarms-card">
          <div className="card-header">
            <div>
              <h2>Habit score: {habit.score === null ? "–" : Math.round(habit.score)}</h2>
              <p>
                {habit.partial
                  ? "Some parts have no data yet, so the remaining weights are scaled up."
                  : "All four parts have data."}
              </p>
            </div>
          </div>
          <BarList rows={components} />
          {habit.improvement !== null && habit.improvement !== undefined && (
            <p className="muted-line">
              {habit.improvement >= 0 ? "Up" : "Down"} {Math.abs(habit.improvement)} points versus the
              previous period.
            </p>
          )}
        </section>

        <section className="alarms-card">
          <div className="card-header">
            <div>
              <h2>Wake-up success by day</h2>
              <p>Share of wake-up verifications completed.</p>
            </div>
          </div>
          {dailyWake.every((d) => d.value === null) ? (
            <Empty title="No wake-ups in this period" />
          ) : (
            <BarList rows={dailyWake} />
          )}
        </section>
      </div>

      <div className="two-column">
        <section className="alarms-card">
          <div className="card-header"><div><h2>Challenge accuracy by type</h2></div></div>
          {byType.length ? <BarList rows={byType} /> : <Empty title="No challenges attempted yet" />}
          <div className="card-header" style={{ marginTop: 18 }}>
            <div>
              <h2>By difficulty</h2>
              <p>Current preference: {titleCase(dash.difficulty.current)}</p>
            </div>
          </div>
          {byLevel.length ? <BarList rows={byLevel} /> : null}
          {dash.difficulty.changes.length > 0 && (
            <p className="muted-line">
              Difficulty shifts: {dash.difficulty.changes.map((c) => `${titleCase(c.from)} → ${titleCase(c.to)}`).join(", ")}
            </p>
          )}
        </section>

        <section className="alarms-card">
          <div className="card-header"><div><h2>Snooze patterns</h2></div></div>
          {patterns.snooze.total_snoozes === 0 ? (
            <Empty title="No snoozes recorded">Snoozes appear here once you use the snooze button on a ringing alarm.</Empty>
          ) : (
            <>
              <p className="muted-line">
                {patterns.snooze.total_snoozes} snoozes. Most often on {patterns.snooze.peak_weekday}
                {patterns.snooze.peak_hour !== null ? ` around ${String(patterns.snooze.peak_hour).padStart(2, "0")}:00` : ""}.
              </p>
              <BarList
                rows={patterns.snooze.by_weekday.map((d) => ({ label: d.day, value: d.count }))}
                suffix=""
                max={Math.max(1, ...patterns.snooze.by_weekday.map((d) => d.count))}
              />
            </>
          )}
          {dash.snooze.available && (
            <p className="muted-line">
              Dismissal success: {dash.snooze.dismissal_success_rate_percent ?? "–"}% · snooze reduction vs
              previous: {dash.snooze.snooze_reduction_percent ?? "–"}%
            </p>
          )}
        </section>
      </div>

      <div className="two-column">
        <section className="alarms-card">
          <div className="card-header"><div><h2>Wake-up behavior</h2></div></div>
          {patterns.wake_up.successful_wakeups === 0 ? (
            <Empty title="No successful wake-ups yet" />
          ) : (
            <>
              <p className="muted-line">
                Average wake time {patterns.wake_up.average_wake_time}
                {patterns.wake_up.variability_minutes !== null ? ` (varies by ±${patterns.wake_up.variability_minutes} min)` : ""}.
                {patterns.wake_up.minutes_after_target !== null
                  ? ` That is ${Math.abs(patterns.wake_up.minutes_after_target)} min ${patterns.wake_up.minutes_after_target >= 0 ? "after" : "before"} your target.`
                  : ""}
              </p>
              <BarList
                rows={patterns.wake_up.success_by_weekday.map((d) => ({ label: d.day, value: d.success_rate_percent }))}
              />
            </>
          )}
        </section>

        <section className="alarms-card">
          <div className="card-header"><div><h2>Sleep</h2></div></div>
          {dash.sleep.available ? (
            <>
              <p className="muted-line">
                {dash.sleep.nights_logged} nights · average {minutesLabel(dash.sleep.average_duration_minutes)} (goal{" "}
                {minutesLabel(dash.sleep.goal_minutes)}) · on schedule {dash.sleep.adherence_percent ?? "–"}%
              </p>
              {patterns.sleep && (
                <p className="muted-line">
                  Average bedtime {patterns.sleep.average_bedtime}
                  {patterns.sleep.bedtime_variability_minutes !== null ? ` (±${patterns.sleep.bedtime_variability_minutes} min)` : ""}.
                </p>
              )}
              <BarList
                rows={dash.sleep.trend.slice(-14).map((n) => ({ label: n.date.slice(5), value: n.duration_minutes / 60 }))}
                suffix="h"
                max={12}
              />
            </>
          ) : (
            <Empty title="No sleep logged">{dash.sleep.reason}</Empty>
          )}

          <form className="inline-form" onSubmit={saveSleep}>
            <strong>Log last night</strong>
            <input type="date" value={sleepForm.sleep_date} max={todayIso()}
              onChange={(e) => setSleepForm({ ...sleepForm, sleep_date: e.target.value })} required />
            <label>Bed <input type="time" value={sleepForm.bed_time}
              onChange={(e) => setSleepForm({ ...sleepForm, bed_time: e.target.value })} required /></label>
            <label>Wake <input type="time" value={sleepForm.wake_time}
              onChange={(e) => setSleepForm({ ...sleepForm, wake_time: e.target.value })} required /></label>
            <label>Quality
              <select value={sleepForm.quality} onChange={(e) => setSleepForm({ ...sleepForm, quality: e.target.value })}>
                {[1, 2, 3, 4, 5].map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </label>
            <button className="small-button" type="submit">Save</button>
          </form>
        </section>
      </div>

      <section className="alarms-card">
        <div className="card-header"><div><h2>Productivity</h2>
          <p>Rate your day and see how it relates to how you woke up.</p></div></div>
        {dash.productivity.available ? (
          <>
            <p className="muted-line">
              {dash.productivity.days_logged} days · average rating {dash.productivity.average_rating}/10
              {dash.productivity.task_completion_percent !== null ? ` · ${dash.productivity.task_completion_percent}% of tasks done` : ""}
            </p>
            <p className="muted-line">
              Rating after a successful wake-up: {dash.productivity.correlation.rating_after_successful_wakeup ?? "–"} ·
              after an unsuccessful one: {dash.productivity.correlation.rating_after_unsuccessful_wakeup ?? "–"}
              {dash.productivity.correlation.pearson_r !== null ? ` · correlation r = ${dash.productivity.correlation.pearson_r}` : ""}
            </p>
            <p className="muted-line small-note">{dash.productivity.correlation.note}</p>
          </>
        ) : (
          <Empty title="No check-ins yet">{dash.productivity.reason}</Empty>
        )}
        <form className="inline-form" onSubmit={saveProductivity}>
          <input type="date" value={prodForm.log_date} max={todayIso()}
            onChange={(e) => setProdForm({ ...prodForm, log_date: e.target.value })} required />
          <label>Rating (1-10)
            <input type="number" min={1} max={10} value={prodForm.rating}
              onChange={(e) => setProdForm({ ...prodForm, rating: e.target.value })} required /></label>
          <label>Tasks planned
            <input type="number" min={0} value={prodForm.tasks_planned}
              onChange={(e) => setProdForm({ ...prodForm, tasks_planned: e.target.value })} /></label>
          <label>Tasks done
            <input type="number" min={0} value={prodForm.tasks_completed}
              onChange={(e) => setProdForm({ ...prodForm, tasks_completed: e.target.value })} /></label>
          <label>Focus (min)
            <input type="number" min={0} value={prodForm.focus_minutes}
              onChange={(e) => setProdForm({ ...prodForm, focus_minutes: e.target.value })} /></label>
          <button className="small-button" type="submit">Save</button>
        </form>
      </section>

      <section className="alarms-card">
        <div className="card-header"><div><h2>Recommendations</h2></div></div>
        <ul className="reason-list">
          {dash.recommendations.map((r) => (
            <li key={r.id}><strong>{r.title}.</strong> {r.detail} <span className="small-note">({r.basis})</span></li>
          ))}
        </ul>
        {dash.recommendation_engagement.available && (
          <p className="muted-line">
            You acted on {dash.recommendation_engagement.accepted} of {dash.recommendation_engagement.viewed} viewed
            recommendations ({dash.recommendation_engagement.acceptance_rate_percent ?? "–"}%).
          </p>
        )}
      </section>
    </div>
  );
}

export default Analytics;
