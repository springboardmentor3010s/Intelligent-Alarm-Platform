// CerebroKognit | Developer: Pawan Simha R | Infosys Virtual Internship 7.0 | Guide: Shanmukha Priya
import React, { useEffect, useState } from 'react';
import { ClockIcon } from './Icons';
import {
  formatDateTime,
  formatDate,
  getUserTimeZone,
} from '../../utils/timeFormat';

function zoneAbbrev(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    const tz = parts.find(p => p.type === 'timeZoneName');
    return (tz && tz.value) || '';
  } catch {
    return '';
  }
}

/**
 * Live clock pinned to the top-right of the authenticated shell. Ticks every
 * second and always renders in the user's selected timezone + 12/24 format, so
 * it reflects a Profile timezone/format change within one second.
 */
export default function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const tz = getUserTimeZone();
  const stamp = now.toISOString();

  return (
    <div
      className="live-clock"
      role="status"
      aria-label={`Local time in ${tz}`}
      title={tz}
    >
      <ClockIcon size={15} />
      <div className="live-clock__body">
        <span className="live-clock__time tabular">
          {formatDateTime(stamp, { withSeconds: true })}
        </span>
        <span className="live-clock__meta">
          {zoneAbbrev(tz)} · {formatDate(stamp)}
        </span>
      </div>
    </div>
  );
}