// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import LiveClock from './LiveClock';

describe('LiveClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T10:00:00.000Z'));
    localStorage.setItem('user', JSON.stringify({ timezone: 'Asia/Kolkata' }));
    localStorage.setItem('ck-time-format', '24');
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('renders the current time in the user timezone window', () => {
    const { container } = render(<LiveClock />);
    const chip = container.querySelector('.live-clock');
    expect(chip).toBeTruthy();
    // 10:00 UTC == 15:30 IST
    expect(container.querySelector('.live-clock__time').textContent).toMatch(/15:30:0\d/);
    expect(chip.getAttribute('aria-label')).toBe('Local time in Asia/Kolkata');
    expect(container.querySelector('.live-clock__meta').textContent).toContain('2026');
  });

  it('ticks to the next second', () => {
    const { container } = render(<LiveClock />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.querySelector('.live-clock__time').textContent).toMatch(/15:30:0[1-9]/);
  });
});