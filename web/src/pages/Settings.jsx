import React, { useEffect, useState } from 'react';
import { Card, Grid } from '../styles';
import { Toggle, SunIcon, MoonIcon, SectionHeader, Badge } from '../components/ui';
import { getTheme, setTheme as applyTheme } from '../theme';

const SETTING_KEYS = ['notifications', 'auto_dismiss', 'vibrate'];

const SETTING_META = {
  notifications: {
    label: 'Alarm Notifications',
    desc: 'Receive alerts when scheduled wake-up routines fire.',
    scope: 'Cloud-synced · Affects notifications',
  },
  auto_dismiss: {
    label: 'Auto-dismiss on Challenge Completion',
    desc: 'Automatically silence and dismiss the alarm once all puzzle answers are verified.',
    scope: 'Cloud-synced · Affects alarms',
  },
  vibrate: {
    label: 'Haptic & Vibration Alerts',
    desc: 'Vibrate device continuously during active alarm sounding.',
    scope: 'Cloud-synced · Affects device alerts',
  },
};

export default function Settings() {
  const [settings, setSettings] = useState({ notifications: true, auto_dismiss: false, vibrate: true });
  const [theme, setThemeState] = useState(getTheme);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/v1/users/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) setSettings({ notifications: !!data.notifications, auto_dismiss: !!data.auto_dismiss, vibrate: !!data.vibrate });
      })
      .catch(console.error);
  }, []);

  const setTheme = value => {
    setThemeState(value);
    applyTheme(value);
  };

  const toggleSetting = key => {
    const next = !settings[key];
    setSettings(s => ({ ...s, [key]: next }));
    const token = localStorage.getItem('token');
    fetch(`/api/v1/users/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ [key]: next }),
    }).catch(err => console.warn(`Could not persist ${key}`, err));
  };

  return (
    <div className="page">
      <SectionHeader
        title="Settings"
        subtitle="Manage alarm automation, notification routing, and local interface preferences"
      />

      <Grid className="grid-cards--3">
        {/* Category 1: Alarm Automation & Behavior */}
        <Card className="p-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div className="card-label mb-0"><span className="sys-label">Alarm Automation</span></div>
            <Badge tone="brand">Affects Alarms</Badge>
          </div>

          <div className="settings-list">
            {SETTING_KEYS.map(key => (
              <div key={key} style={{ paddingBottom: '0.65rem' }}>
                <Toggle
                  checked={settings[key]}
                  onChange={() => toggleSetting(key)}
                  label={SETTING_META[key].label}
                  desc={SETTING_META[key].desc}
                />
                <span className="text-xs text-muted-600" style={{ fontSize: '0.725rem', marginTop: '0.2rem', display: 'block' }}>
                  {SETTING_META[key].scope}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Category 2: Appearance & Display */}
        <Card className="p-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div className="card-label mb-0"><span className="sys-label">Appearance</span></div>
            <Badge tone="subtle">Local Storage</Badge>
          </div>

          <p className="text-sm text-muted-600 mb-4" style={{ lineHeight: 1.5 }}>
            Select your preferred visual mode. Changes take effect immediately across all screens and persist on this device.
          </p>

          <div className="segmented" role="radiogroup" aria-label="Theme" style={{ width: '100%' }}>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'light'}
              className={`segmented__option ${theme === 'light' ? 'is-active' : ''}`}
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => setTheme('light')}
            >
              <SunIcon size={15} /> Light
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'dark'}
              className={`segmented__option ${theme === 'dark' ? 'is-active' : ''}`}
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => setTheme('dark')}
            >
              <MoonIcon size={15} /> Dark
            </button>
          </div>

          <div className="text-xs text-muted-600 mt-4" style={{ lineHeight: 1.45 }}>
            Active theme: <strong>{theme === 'light' ? 'Light (Porcelain / Violet)' : 'Dark (Obsidian / Violet)'}</strong>. Applied immediately.
          </div>
        </Card>

        {/* Category 3: System & Synchronization Telemetry */}
        <Card className="p-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div className="card-label mb-0"><span className="sys-label">System Telemetry</span></div>
            <span className="pill pill-success"><span className="led led--on" style={{ marginRight: '0.25rem' }} /> Connected</span>
          </div>

          <div className="settings-list" style={{ marginTop: '0.75rem' }}>
            <div className="settings-row">
              <div className="settings-row__label">Platform</div>
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>CerebroKognit v2.4</div>
            </div>
            <div className="settings-row">
              <div className="settings-row__label">Sync Protocol</div>
              <div className="text-sm text-muted-600">REST API · Bearer JWT</div>
            </div>
            <div className="settings-row">
              <div className="settings-row__label">AI Engine</div>
              <div className="text-sm text-muted-600">PyTorch Difficulty ML</div>
            </div>
            <div className="settings-row">
              <div className="settings-row__label">Offline Storage</div>
              <div className="text-sm text-muted-600">Active (Web LocalStorage)</div>
            </div>
          </div>
        </Card>
      </Grid>
    </div>
  );
}