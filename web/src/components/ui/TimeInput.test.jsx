// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useState, useEffect } from 'react';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import TimeInput from './TimeInput';

function Harness({ value: initial = '07:00', onChange }) {
  const [v, setV] = useState(initial);
  // Allow parent to control value via prop (controlled component pattern)
  useEffect(() => setV(initial), [initial]);
  return (
    <TimeInput
      value={v}
      onChange={val => {
        setV(val);
        onChange?.(val);
      }}
    />
  );
}

describe('TimeInput', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders a native 24h time input when the format is 24', () => {
    localStorage.setItem('ck-time-format', '24');
    const { container } = render(<Harness value="07:00" onChange={() => {}} />);
    const input = container.querySelector('input[type="time"]');
    expect(input).toBeTruthy();
    expect(input.value).toBe('07:00');
  });

  it('renders Hour / Minute / Period selects in 12h mode', () => {
    localStorage.setItem('ck-time-format', '12');
    render(<Harness value="07:00" onChange={() => {}} />);
    expect(screen.getByLabelText('Hour')).toBeInTheDocument();
    expect(screen.getByLabelText('Minute')).toBeInTheDocument();
    expect(screen.getByLabelText('Period')).toBeInTheDocument();
    expect(document.querySelector('input[type="time"]')).toBeNull();
  });

  it('converts a period change back to a 24h value', () => {
    localStorage.setItem('ck-time-format', '12');
    const values = [];
    render(<Harness value="07:00" onChange={v => values.push(v)} />);

    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'PM' } });
    expect(values[values.length - 1]).toBe('19:00');

    fireEvent.change(screen.getByLabelText('Hour'), { target: { value: '12' } });
    expect(values[values.length - 1]).toBe('12:00');
  });

  it('round-trips midnight correctly', () => {
    localStorage.setItem('ck-time-format', '12');
    const values = [];
    render(<Harness value="00:00" onChange={v => values.push(v)} />);
    expect(screen.getByLabelText('Hour').value).toBe('12');
    expect(screen.getByLabelText('Period').value).toBe('AM');

    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'PM' } });
    expect(values[values.length - 1]).toBe('12:00');
  });
});