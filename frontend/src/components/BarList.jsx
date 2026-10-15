// A simple horizontal bar list that reuses the app's progress bar styles.
function BarList({ rows, valueKey = "value", labelKey = "label", suffix = "%", max = 100 }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="bar-list">
      {rows.map((row) => {
        const value = row[valueKey];
        const width = value === null || value === undefined ? 0 : Math.min(100, (value / max) * 100);
        return (
          <div className="bar-list-row" key={row[labelKey]}>
            <span className="bar-list-label">{row[labelKey]}</span>
            <div className="progress">
              <div style={{ width: `${width}%` }}></div>
            </div>
            <span className="bar-list-value">
              {value === null || value === undefined ? "–" : `${Math.round(value * 10) / 10}${suffix}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default BarList;
