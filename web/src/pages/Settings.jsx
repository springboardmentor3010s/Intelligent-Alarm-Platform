import React, { useEffect, useState } from 'react';
import { Card, Grid } from '../styles';
import { Toggle, SunIcon, MoonIcon } from '../components/ui';
import { getTheme, setTheme as applyTheme } from '../theme';

const SETTING_KEYS = ['notifications', 'auto_dismiss', 'vibrate'];

const SETTING_META = {
  notifications: { label: 'Alarm notifications', desc: 'Receive alerts for scheduled alarms' },
  auto_dismiss: { label: 'Auto-dismiss on challenge', desc: 'Dismiss the alarm once the challenge is solved' },
  vibrate: { label: 'Haptic feedback', desc: 'Vibrate when the alarm triggers' },
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
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <div className="subtitle">Personalize your alarm & notification preferences</div>
        </div>
      </div>

      <Grid className="grid-cards--3">
        <Card className="p-4">
          <div className="card-label mb-2">Alarm Behavior</div>
          <div className="settings-list">
            {SETTING_KEYS.map(key => (
              <Toggle
                key={key}
                checked={settings[key]}
                onChange={() => toggleSetting(key)}
                label={SETTING_META[key].label}
                desc={SETTING_META[key].desc}
              />
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="card-label mb-3">Appearance</div>
          <div className="text-sm text-muted-600 mb-4">Choose how CerebroKognit looks. Applied instantly across the app.</div>
          <div className="segmented" role="radiogroup" aria-label="Theme">
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'dark'}
              className={`segmented__option ${theme === 'dark' ? 'is-active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              <MoonIcon size={15} /> Dark
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'light'}
              className={`segmented__option ${theme === 'light' ? 'is-active' : ''}`}
              onClick={() => setTheme('light')}
            >
              <SunIcon size={15} /> Light
            </button>
          </div>
          <div className="text-xs text-muted-600 mt-4">
            Theme is stored locally on this device.
          </div>
        </Card>

        <Card className="p-4">
          <div className="card-label mb-2">About</div>
          <div className="settings-list">
            <div className="settings-row">
              <div className="settings-row__label">Application</div>
              <div className="text-sm text-muted-600">CerebroKognit</div>
            </div>
            <div className="settings-row">
              <div className="settings-row__label">Version</div>
              <div className="text-sm text-muted-600">{import.meta.env.VITE_APP_VERSION || '1.0.0'}</div>
            </div>
            <div className="settings-row">
              <div className="settings-row__label">Data</div>
              <div className="text-sm text-muted-600">Synced to your account</div>
            </div>
          </div>
        </Card>
      </Grid>
    </div>
  );
}