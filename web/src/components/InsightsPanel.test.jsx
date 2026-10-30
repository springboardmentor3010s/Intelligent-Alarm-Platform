// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import InsightsPanel from './InsightsPanel';

function mockApi(routes) {
  global.fetch = vi.fn((url) => {
    const key = String(url).split('?')[0];
    const hit = routes[key];
    if (!hit) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    return Promise.resolve({ ok: hit.status < 400, status: hit.status, json: () => Promise.resolve(hit.body) });
  });
}

describe('InsightsPanel', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the model version, a gated anomaly reason, and the forecast', async () => {
    mockApi({
      '/api/v1/analytics/ml-status': {
        status: 200,
        body: { torch_available: true, model_loaded: true, model_version: '1.0', training_data: 'synthetic' },
      },
      '/api/v1/analytics/anomalies': { status: 200, body: { available: false, reason: 'Need more history.' } },
      '/api/v1/analytics/forecast': {
        status: 200,
        body: { available: true, trend: 'improving', confidence: 'medium', horizon_days: 7, predicted_next_week: 78.5 },
      },
    });
    render(<InsightsPanel />);

    await waitFor(() => expect(screen.getByText('Need more history.')).toBeInTheDocument());
    expect(screen.getByText('1.0')).toBeInTheDocument();
    expect(screen.getByText('improving')).toBeInTheDocument();
    expect(screen.getByText('78.5')).toBeInTheDocument();
  });

  it('lists anomaly findings when available', async () => {
    global.fetch = vi.fn((url) => {
      const key = String(url).split('?')[0];
      if (key === '/api/v1/analytics/anomalies') {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({
            available: true,
            anomalies: [{ type: 'snooze_spike', severity: 'warning', message: 'Snoozed 5 times today.' }],
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
    });
    render(<InsightsPanel />);

    await waitFor(() => expect(screen.getByText('Snoozed 5 times today.')).toBeInTheDocument());
    expect(screen.getByText('warning')).toBeInTheDocument();
  });
});
