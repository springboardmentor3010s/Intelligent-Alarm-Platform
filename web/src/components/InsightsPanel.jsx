// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useEffect, useState } from 'react';
import { Card } from '../styles';
import { Badge } from '../components/ui';
import { apiFetch } from '../utils/api';

const SEVERITY_TONE = { warning: 'warm', critical: 'danger', info: 'subtle' };

function Row({ label, value }) {
  return (
    <div className="settings-row">
      <div className="settings-row__label">{label}</div>
      <div className="text-sm text-muted-600">{value}</div>
    </div>
  );
}

/**
 * Analytics/ML insights: model health, baseline anomalies, and forecast.
 * Each endpoint gates itself on history and returns {available:false, reason}
 * when there is not enough data — surfaced verbatim, never fabricated.
 */
export default function InsightsPanel() {
  const [ml, setMl] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [forecast, setForecast] = useState(null);

  useEffect(() => {
    let alive = true;
    const get = (path) => apiFetch(path).then(r => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([
      get('/api/v1/analytics/ml-status'),
      get('/api/v1/analytics/anomalies'),
      get('/api/v1/analytics/forecast'),
    ]).then(([m, a, f]) => {
      if (!alive) return;
      setMl(m);
      setAnomalies(a);
      setForecast(f);
    });
    return () => { alive = false; };
  }, []);

  return (
    <Card className="p-4">
      <div className="card-label mb-3"><span className="sys-label">AI Insights</span></div>
      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {/* Difficulty model health */}
        <div>
          <div className="text-xs text-muted-600 mb-2">Difficulty model</div>
          {ml ? (
            <div className="settings-list">
              <Row label="Torch available" value={ml.torch_available ? 'Yes' : 'No'} />
              <Row label="Model loaded" value={ml.model_loaded ? 'Yes' : 'No (rule fallback)'} />
              <Row label="Model version" value={ml.model_version || '—'} />
              <Row label="Training data" value={ml.training_data || '—'} />
            </div>
          ) : (
            <p className="text-sm text-muted-600">Unavailable.</p>
          )}
        </div>

        {/* Anomalies */}
        <div>
          <div className="text-xs text-muted-600 mb-2">Anomalies</div>
          {anomalies == null ? (
            <p className="text-sm text-muted-600">Loading…</p>
          ) : !anomalies.available ? (
            <p className="text-sm text-muted-600">{anomalies.reason}</p>
          ) : anomalies.anomalies.length === 0 ? (
            <p className="text-sm text-muted-600">No anomalies detected.</p>
          ) : (
            <ul style={{ display: 'grid', gap: '0.6rem', margin: 0, padding: 0, listStyle: 'none' }}>
              {anomalies.anomalies.map((a, i) => (
                <li key={`${a.type}-${i}`}>
                  <Badge tone={SEVERITY_TONE[a.severity] || 'subtle'}>{a.severity}</Badge>
                  <div className="text-sm" style={{ marginTop: '0.25rem' }}>{a.message}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Forecast */}
        <div>
          <div className="text-xs text-muted-600 mb-2">Forecast</div>
          {forecast == null ? (
            <p className="text-sm text-muted-600">Loading…</p>
          ) : !forecast.available ? (
            <p className="text-sm text-muted-600">{forecast.reason}</p>
          ) : (
            <div className="settings-list">
              <Row label="Trend" value={forecast.trend} />
              <Row label="Confidence" value={forecast.confidence} />
              <Row label={`Next ${forecast.horizon_days}d score`} value={forecast.predicted_next_week} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
