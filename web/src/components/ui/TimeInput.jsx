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
 * it renders Hour / Minute / AM-PM selects. Always emits a 24h "HH:MM" value,
 * so the payload contract is unchanged.
 */
export default function TimeInput({ id, value = '07:00', onChange, className }) {
  if (!hour12()) {
    return (
      <input
        id={id}
        type="time"
        className={className}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    );
  }

  const { h12, minute, period } = toParts(value);

  return (
    <div className={`time-input${className ? ` ${className}` : ''}`}>
      <select
        aria-label="Hour"
        value={h12}
        onChange={e => onChange(fromParts({ h12: Number(e.target.value), minute, period }))}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map(x => (
          <option key={x} value={x}>{x}</option>
        ))}
      </select>
      <span className="time-input__sep">:</span>
      <select
        aria-label="Minute"
        value={minute}
        onChange={e => onChange(fromParts({ h12, minute: Number(e.target.value), period }))}
      >
        {MINUTES.map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        aria-label="Period"
        value={period}
        onChange={e => onChange(fromParts({ h12, minute, period: e.target.value }))}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}