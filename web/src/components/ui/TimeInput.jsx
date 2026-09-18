// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React from 'react';
import { hour12, parseTimeOfDay, toTimeInputValue } from '../../utils/timeFormat';

const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function toParts(value) {
  const parsed = parseTimeOfDay(value);
  const { hour = 7, minute = 0 } = parsed || {};
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return { hour, minute, h12, period: hour < 12 ? 'AM' : 'PM' };
}

function fromParts({ h12, minute, period }) {
  let hour = h12 % 12;
  if (period === 'PM') hour += 12;
  return toTimeInputValue({ hour, minute });
}

/**
 * Alarm/event time picker that follows the user's global 12/24 preference.
 * In 24h mode it renders the native browser `<input type="time">`; in 12h mode
 * it renders a prominent clock face plus Hour / Minute / AM-PM selector rows.
 * Always emits a 24h "HH:MM" value, so the payload contract is unchanged.
 */
export default function TimeInput({ id, value = '07:00', onChange, className }) {
  if (!hour12()) {
    return (
      <div className={`time-picker${className ? ` ${className}` : ''}`}>
        <input
          id={id}
          type="time"
          className="time-picker__native"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    );
  }

  const { h12, minute, period } = toParts(value);
  const face = `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;

  return (
    <div className={`time-picker${className ? ` ${className}` : ''}`}>
      <div className="time-picker__face" aria-hidden="true">
        {face}
      </div>

      <div className="time-picker__controls">
        <div className="time-picker__seg">
          <span className="time-picker__seg-label">Hour</span>
          <select
            aria-label="Hour"
            className="time-picker__select"
            value={h12}
            onChange={e => onChange(fromParts({ h12: Number(e.target.value), minute, period }))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(x => (
              <option key={x} value={x}>{String(x).padStart(2, '0')}</option>
            ))}
          </select>
        </div>

        <span className="time-picker__sep" aria-hidden="true">:</span>

        <div className="time-picker__seg">
          <span className="time-picker__seg-label">Minute</span>
          <select
            aria-label="Minute"
            className="time-picker__select"
            value={minute}
            onChange={e => onChange(fromParts({ h12, minute: Number(e.target.value), period }))}
          >
            {MINUTES.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="time-picker__seg time-picker__seg--period">
          <span className="time-picker__seg-label">Period</span>
          <select
            aria-label="Period"
            className="time-picker__select"
            value={period}
            onChange={e => onChange(fromParts({ h12, minute, period: e.target.value }))}
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>
    </div>
  );
}