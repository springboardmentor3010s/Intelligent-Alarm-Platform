// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

const TRIGGERS = [
  { key: 'bedtime', label: 'Bedtime reminder' },
  { key: 'challenge', label: 'Challenge reminder' },
  { key: 'habit', label: 'Habit alert' },
  { key: 'progress', label: 'Progress update' },
];

/**
 * Push notification diagnostics (Module 11): delivery provider status,
 * the current user's registered device tokens, a test send, and the
 * trigger-style reminders. Degrades honestly when push is not configured.
 */
export default function NotificationsPanel() {
  const [status, setStatus] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch('/api/v1/notifications/status')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setStatus(d); })
      .catch(() => {});
    apiFetch('/api/v1/notifications/tokens')
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive && Array.isArray(d)) setTokens(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const trigger = async (path) => {
    setBusy(true);
    setResult(null);
    const res = await apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setResult(res.ok
      ? `Sent ${data.sent ?? 0} of ${data.attempted ?? 0} · failed ${data.failed ?? 0}${data.duplicate ? ' · duplicate suppressed' : ''}`
      : (data.detail || 'Notification could not be sent.'));
  };

  const configured = !!status?.configured;

  return (
    <div>
      <div className="settings-list">
        <div className="settings-row">
          <div className="settings-row__label">Provider</div>
          <div className="text-sm text-muted-600">{status ? status.provider : '—'}</div>
        </div>
        <div className="settings-row">
          <div className="settings-row__label">Push delivery</div>
          <div className="text-sm text-muted-600">
            {status ? (status.configured ? 'Configured' : 'Not configured') : '—'}
          </div>
        </div>
        <div className="settings-row">
          <div className="settings-row__label">Registered devices</div>
          <div className="text-sm text-muted-600 tabular">{tokens.length}</div>
        </div>
      </div>

      {status?.message && <p className="text-xs text-muted-600 mt-2">{status.message}</p>}

      {tokens.length > 0 && (
        <ul className="text-xs text-muted-600" style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
          {tokens.map(t => (
            <li key={t.id}>{t.platform || 'device'} · {String(t.token).slice(0, 12)}…</li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || !status?.configured}
          onClick={() => trigger('/api/v1/notifications/test')}
        >
          Send test notification
        </button>
        {TRIGGERS.map(t => (
          <button
            key={t.key}
            type="button"
            className="btn btn-secondary"
            disabled={busy || !status?.configured}
            onClick={() => trigger(`/api/v1/notifications/triggers/${t.key}`)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {result && <p className="text-xs text-muted-600" style={{ marginTop: '0.5rem' }}>{result}</p>}
    </div>
  );
}
